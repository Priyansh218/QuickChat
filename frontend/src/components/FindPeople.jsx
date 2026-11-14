
import { useEffect, useState } from "react";
import { Search, Users, Plus, Check } from "lucide-react";

export default function FindPeople({ api, onCreateGroup }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    const timer = setTimeout(async () => {
      try {
        const result = await api.searchUsers(query.trim());

        if (active) {
          setResults(result.users || []);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
          setResults([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, api]);

  function toggleUser(person) {
    setSelected(previous =>
      previous.some(user => user.id === person.id)
        ? previous.filter(user => user.id !== person.id)
        : [...previous, person]
    );
  }

  return (
    <section className="people-panel">
      <div className="people-panel-header">
        <p className="eyebrow">DISCOVER</p>
        <h2>Find People</h2>
        <p>
          Search for registered QuickChat users and find
          people to connect with.
        </p>
      </div>

      <div className="people-search-box">
        <Search size={18} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by username..."
        />
      </div>

      <div className="people-results">
        {query.trim().length < 2 ? (
          <div className="people-empty">
            <Search size={30} />
            <p>Find people on QuickChat</p>
            <span>
              Enter at least 2 characters of a username.
            </span>
          </div>
        ) : loading ? (
          <div className="people-empty">
            <p>Searching users...</p>
          </div>
        ) : error ? (
          <div className="people-empty">
            <p>{error}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="people-empty">
            <Users size={30} />
            <p>No users found</p>
            <span>Try searching with another username.</span>
          </div>
        ) : (
          results.map(person => {
            const isSelected = selected.some(
              user => user.id === person.id
            );

            return (
              <button
                type="button"
                key={person.id}
                className={`people-result ${
                  isSelected ? "selected" : ""
                }`}
                onClick={() => toggleUser(person)}
              >
                <div className="avatar">
                  {person.fullName?.charAt(0).toUpperCase()}
                </div>

                <div className="profile-info">
                  <strong>{person.fullName}</strong>
                  <span>@{person.username}</span>
                </div>

                <span className={`select-user ${
                  isSelected ? "chosen" : ""
                }`}>
                  {isSelected ? (
                    <Check size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>

      {selected.length > 0 && (
        <div className="people-selection">
          <p>
            {selected.length} {selected.length === 1
              ? "person"
              : "people"} selected
          </p>

          <div className="selected-people-list">
            {selected.map(person => (
              <span key={person.id}>
                {person.fullName}
              </span>
            ))}
          </div>

          <button
            className="primary-btn"
            onClick={() => onCreateGroup(selected)}
          >
            <Users size={18} />
            Create group with selected people
          </button>
        </div>
      )}
    </section>
  );
}
