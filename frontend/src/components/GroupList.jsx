
import { Search, Plus, Users, MessageCircle } from "lucide-react";

export default function GroupList({
  groups, selectedGroup, onSelect, onCreate, search, setSearch
}) {
  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="group-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h2>My Groups</h2>
        </div>

        <button className="icon-btn add-btn" onClick={onCreate}>
          <Plus size={20} />
        </button>
      </div>

      <div className="group-search">
        <Search size={17} />
        <input
          placeholder="Search groups..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="group-list">
        {filteredGroups.map(group => (
          <button
            key={group.id}
            className={`group-item ${selectedGroup?.id === group.id ? "selected" : ""}`}
            onClick={() => onSelect(group)}
          >
            <div className="group-avatar">
              <Users size={21} />
            </div>

            <div className="group-info">
              <strong>{group.name}</strong>
              <span>{group.memberCount} members</span>
            </div>
          </button>
        ))}

        {filteredGroups.length === 0 && (
          <div className="empty-groups">
            <MessageCircle size={28} />
            <p>No groups found</p>
            <span>Create a group to start chatting.</span>
          </div>
        )}
      </div>
    </section>
  );
}
