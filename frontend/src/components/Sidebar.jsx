
import {
  MessageCircle, Users, Search, LogOut
} from "lucide-react";

export default function Sidebar({
  user,
  onLogout,
  activeView,
  onViewChange
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">
          <MessageCircle size={23} />
        </div>
        <span>QuickChat</span>
      </div>

      <div className="sidebar-section">
        <p className="section-label">WORKSPACE</p>

        <button
          className={`sidebar-action ${
            activeView === "groups" ? "active" : ""
          }`}
          onClick={() => onViewChange("groups")}
        >
          <Users size={18} />
          My Groups
        </button>

        <button
          className={`sidebar-action ${
            activeView === "people" ? "active" : ""
          }`}
          onClick={() => onViewChange("people")}
        >
          <Search size={18} />
          Find People
        </button>
      </div>

      <div className="sidebar-bottom">
        <div className="profile-card">
          <div className="avatar">
            {user.fullName?.charAt(0).toUpperCase()}
          </div>

          <div className="profile-info">
            <strong>{user.fullName}</strong>
            <span>@{user.username}</span>
          </div>

          <button
            className="icon-btn"
            onClick={onLogout}
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
