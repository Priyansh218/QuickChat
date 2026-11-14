
import { useState } from "react";
import { X, Search, Users, Plus } from "lucide-react";

export default function CreateGroup({ api, onClose, onCreated, initialMembers = [] }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(initialMembers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function searchUsers(value) {
    setQuery(value);
    setError("");

    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    try {
      const result = await api.searchUsers(value);
      setResults(result.users);
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleUser(user) {
    setSelected(previous =>
      previous.some(item => item.id === user.id)
        ? previous.filter(item => item.id !== user.id)
        : [...previous, user]
    );
  }

  async function create() {
    if (name.trim().length < 2) {
      setError("Enter a group name.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await api.createGroup({
        name: name.trim(),
        description: description.trim(),
        memberIds: selected.map(user => user.id)
      });

      onCreated(result.group);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-card" onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">NEW CONVERSATION</p>
            <h2>Create a group</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X /></button>
        </div>

        <label className="form-label">Group name</label>
        <input
          className="form-input"
          placeholder="e.g. M.Tech Project Team"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
        />

        <label className="form-label">Description</label>
        <input
          className="form-input"
          placeholder="What's this group about?"
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={200}
        />

        <label className="form-label">Add members</label>
        <div className="group-search modal-search">
          <Search size={17} />
          <input
            placeholder="Search by username..."
            value={query}
            onChange={e => searchUsers(e.target.value)}
          />
        </div>

        <div className="user-results">
          {results.map(user => {
            const isSelected = selected.some(item => item.id === user.id);

            return (
              <button
                key={user.id}
                className="user-result"
                onClick={() => toggleUser(user)}
              >
                <div className="avatar">{user.fullName[0].toUpperCase()}</div>
                <div className="profile-info">
                  <strong>{user.fullName}</strong>
                  <span>@{user.username}</span>
                </div>
                <span className={`select-user ${isSelected ? "chosen" : ""}`}>
                  {isSelected ? "Selected" : <Plus size={17} />}
                </span>
              </button>
            );
          })}
        </div>

        {selected.length > 0 && (
          <p className="selected-count">{selected.length} member(s) selected</p>
        )}

        {error && <p className="chat-error">{error}</p>}

        <button className="primary-btn modal-submit" onClick={create} disabled={loading}>
          <Users size={18} />
          {loading ? "Creating..." : "Create group"}
        </button>
      </div>
    </div>
  );
}
