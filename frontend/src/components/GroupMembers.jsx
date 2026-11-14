
import { useEffect, useState } from "react";
import {
  X,
  ShieldCheck,
  UserPlus,
  Trash2,
  LogOut,
  Search,
  Plus,
  Crown,
  Pencil,
  Save,
  XCircle
} from "lucide-react";

export default function GroupMembers({
  group, user, api, onClose, onChanged
}) {
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [groupName, setGroupName] = useState(group.name);
  const [description, setDescription] = useState(group.description || "");

  const isAdmin = members.some(
    member => member.id === user.id && member.role === "admin"
  );

  async function loadMembers() {
    try {
      const result = await api.getGroup(group.id);
      setMembers(result.members);
      setGroupName(result.group.name);
      setDescription(result.group.description || "");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadMembers();
  }, [group.id]);

  async function saveGroupDetails(e) {
    e.preventDefault();

    if (loading) return;

    setError("");

    if (groupName.trim().length < 2 || groupName.trim().length > 50) {
      setError("Group name must be between 2 and 50 characters.");
      return;
    }

    if (description.trim().length > 200) {
      setError("Description must be 200 characters or fewer.");
      return;
    }

    setLoading(true);

    try {
      await api.updateGroup(group.id, {
        name: groupName.trim(),
        description: description.trim()
      });

      setEditing(false);
      await loadMembers();
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function cancelEditing() {
    setGroupName(group.name);
    setDescription(group.description || "");
    setEditing(false);
    setError("");
  }

  async function searchUsers(value) {
    setQuery(value);
    setSelected(null);
    setError("");

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    try {
      const result = await api.searchUsers(value);
      const existingMemberIds = members.map(member => member.id);

      const availableUsers = result.users.filter(
        foundUser => !existingMemberIds.includes(foundUser.id)
      );

      setResults(availableUsers);
    } catch (err) {
      setError(err.message);
    }
  }

  function selectUser(foundUser) {
    setSelected(foundUser);
  }

  async function addMember(e) {
    e.preventDefault();

    if (!selected || loading) return;

    setLoading(true);
    setError("");

    try {
      await api.addMember(group.id, selected.username);
      setQuery("");
      setResults([]);
      setSelected(null);
      await loadMembers();
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(userId) {
    if (!window.confirm("Remove this member from the group?")) return;

    setError("");

    try {
      await api.removeMember(group.id, userId);
      await loadMembers();
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function transferAdmin(member) {
    const confirmed = window.confirm(
      `Transfer admin rights to ${member.fullName} (@${member.username})?\n\nYou will become a regular member and will no longer be able to manage this group.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      await api.transferAdmin(group.id, member.id);
      await loadMembers();
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteGroup() {
    if (!window.confirm("Permanently delete this group and its messages?")) return;

    try {
      await api.deleteGroup(group.id);
      onChanged(true);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  async function leaveGroup() {
    if (!window.confirm("Are you sure you want to leave this group?")) return;

    try {
      await api.leaveGroup(group.id);
      onChanged(true);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div
        className="modal-card members-modal"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">GROUP SETTINGS</p>
            <h2>{groupName}</h2>
          </div>

          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>

        {isAdmin && (
          <div className="group-edit-section">
            {!editing ? (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setEditing(true)}
              >
                <Pencil size={16} /> Edit group details
              </button>
            ) : (
              <form onSubmit={saveGroupDetails} className="group-edit-form">
                <p className="form-label">Group name</p>

                <input
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="Enter group name"
                  maxLength={50}
                  required
                />

                <p className="form-label">Description</p>

                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe your group..."
                  maxLength={200}
                  rows={3}
                />

                <div className="group-edit-actions">
                  <button
                    type="submit"
                    className="primary-btn"
                    disabled={loading}
                  >
                    <Save size={16} />
                    {loading ? "Saving..." : "Save changes"}
                  </button>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={cancelEditing}
                    disabled={loading}
                  >
                    <XCircle size={16} /> Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <p className="form-label">Members ({members.length})</p>

        <div className="member-list">
          {members.map(member => (
            <div className="member-row" key={member.id}>
              <div className="avatar">
                {member.fullName[0].toUpperCase()}
              </div>

              <div className="profile-info">
                <strong>{member.fullName}</strong>
                <span>@{member.username}</span>
              </div>

              {member.role === "admin" ? (
                <span className="admin-label">
                  <ShieldCheck size={14} /> Admin
                </span>
              ) : isAdmin ? (
                <div className="member-actions">
                  <button
                    className="icon-btn"
                    onClick={() => transferAdmin(member)}
                    title="Transfer admin rights"
                    disabled={loading}
                  >
                    <Crown size={17} />
                  </button>

                  <button
                    className="icon-btn danger"
                    onClick={() => removeMember(member.id)}
                    title="Remove member"
                    disabled={loading}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {isAdmin && (
          <form className="add-member-form" onSubmit={addMember}>
            <p className="form-label">Add a member</p>

            <div className="group-search modal-search">
              <Search size={17} />

              <input
                placeholder="Search by username..."
                value={query}
                onChange={e => searchUsers(e.target.value)}
              />
            </div>

            <div className="user-results">
              {results.map(foundUser => {
                const isSelected = selected?.id === foundUser.id;

                return (
                  <button
                    type="button"
                    key={foundUser.id}
                    className={`user-result ${isSelected ? "selected" : ""}`}
                    onClick={() => selectUser(foundUser)}
                  >
                    <div className="avatar">
                      {foundUser.fullName[0].toUpperCase()}
                    </div>

                    <div className="profile-info">
                      <strong>{foundUser.fullName}</strong>
                      <span>@{foundUser.username}</span>
                    </div>

                    <span
                      className={`select-user ${isSelected ? "chosen" : ""}`}
                    >
                      {isSelected ? "Selected" : <Plus size={17} />}
                    </span>
                  </button>
                );
              })}

              {query.trim().length >= 2 && results.length === 0 && (
                <p className="chat-error">
                  No available users found.
                </p>
              )}
            </div>

            {selected && (
              <p className="selected-count">1 member selected</p>
            )}

            <button
              type="submit"
              className="primary-btn modal-submit"
              disabled={loading || !selected}
            >
              <UserPlus size={17} />
              {loading ? "Adding..." : "Add member"}
            </button>
          </form>
        )}

        {error && <p className="chat-error">{error}</p>}

        <div className="group-danger-actions">
          {isAdmin ? (
            <button className="danger-action" onClick={deleteGroup}>
              <Trash2 size={17} /> Delete group
            </button>
          ) : (
            <button className="danger-action" onClick={leaveGroup}>
              <LogOut size={17} /> Leave group
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
