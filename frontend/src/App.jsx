
import { useCallback, useEffect, useState } from "react";
import { api, getToken, setToken } from "./services/api";

import Auth from "./components/Auth";
import Sidebar from "./components/Sidebar";
import GroupList from "./components/GroupList";
import ChatWindow from "./components/ChatWindow";
import CreateGroup from "./components/CreateGroup";
import GroupMembers from "./components/GroupMembers";
import FindPeople from "./components/FindPeople";

import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [search, setSearch] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeView, setActiveView] = useState("groups");
  const [preselectedMembers, setPreselectedMembers] = useState([]);

  const loadGroups = useCallback(async () => {
    const result = await api.getGroups();
    setGroups(result.groups);
    setSelectedGroup(current => {
      if (!current) return null;
      return result.groups.find(group => group.id === current.id) || null;
    });
  }, []);

  useEffect(() => {
    async function restoreSession() {
      if (!getToken()) {
        setCheckingSession(false);
        return;
      }

      try {
        const result = await api.me();
        setUser(result.user);
        const groupResult = await api.getGroups();
        setGroups(groupResult.groups);
      } catch {
        setToken(null);
      } finally {
        setCheckingSession(false);
      }
    }

    restoreSession();
  }, []);

  // Automatically refresh the group list every 5 seconds
  useEffect(() => {
    if (!user) return;
    let isLoading = false;
    const refreshGroups = async () => {
      if (isLoading) return;
      isLoading = true;
      try {
        await loadGroups();
      }catch (error) {
        console.error("Unable to refresh groups:", error);
      }finally {
      isLoading = false;
      }
    };
    // Refresh periodically
    const interval = setInterval(refreshGroups, 5000);

    // Also refresh when the user returns to the browser tab
    const handleVisibilityChange = () => {
     if (document.visibilityState === "visible") {
       refreshGroups();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", refreshGroups);

    return () => {
     clearInterval(interval);
     document.removeEventListener("visibilitychange", handleVisibilityChange);
     window.removeEventListener("focus", refreshGroups);
    };
  }, [user, loadGroups]);

  async function handleLogin(result) {
    setToken(result.token);
    setUser(result.user);

    const groupResult = await api.getGroups();
    setGroups(groupResult.groups);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setGroups([]);
    setSelectedGroup(null);
    setDialog(null);
  }

  async function handleGroupChanged(deleted = false) {
    await loadGroups();

    if (deleted) {
      setSelectedGroup(null);
    }
  }

  if (checkingSession) {
    return <div className="loading-screen">Loading QuickChat...</div>;
  }

  if (!user) {
    return <Auth api={api} onLogin={handleLogin} />;
  }

  
  return (
    <div className="app-layout">
      <Sidebar
       user={user}
       onLogout={logout}
       activeView={activeView}
       onViewChange={setActiveView}
     />

      {activeView === "groups" ? (
        <GroupList
          groups={groups}
          selectedGroup={selectedGroup}
          onSelect={setSelectedGroup}
          onCreate={() => setDialog("create")}
          search={search}
          setSearch={setSearch}
        />
      ) : (
        <FindPeople
          api={api}
          onCreateGroup={members => {
            setPreselectedMembers(members);
            setDialog("create");
          }}
        />
      )
      }

      <ChatWindow
        group={selectedGroup}
        user={user}
        api={api}
        onGroupInfo={() => setDialog("members")}
      />

      {dialog === "create" && (
        <CreateGroup
          api={api}
          initialMembers={preselectedMembers}
          onClose={() => {
            setDialog(null);
            setPreselectedMembers([]);
          }}
          onCreated={async group => {
            await loadGroups();
            setSelectedGroup(group);
            setActiveView("groups");
            setPreselectedMembers([]);
          }}
        />
      )
      }

      {dialog === "members" && selectedGroup && (
        <GroupMembers
          group={selectedGroup}
          user={user}
          api={api}
          onClose={() => setDialog(null)}
          onChanged={handleGroupChanged}
        />
      )}
    </div>
  )
};
