
import { useState } from "react";
import { MessageCircle, Lock, User, UserRound, ArrowRight } from "lucide-react";

export default function Auth({ onLogin, api }) {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let result;

      if (mode === "register") {
        result = await api.register({
          fullName,
          username,
          password
        });

        setMode("login");
        setPassword("");
        setError("Account created! Please log in.");
      } else {
        result = await api.login({ username, password });
        onLogin(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand-logo auth-logo">
          <MessageCircle size={25} />
        </div>

        <h1>QuickChat</h1>
        <p className="auth-subtitle">
          Your conversations, all in one place.
        </p>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => { setMode("login"); setError(""); }}
          >
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => { setMode("register"); setError(""); }}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <label className="auth-field">
              <span>Full name</span>
              <div className="field-input">
                <UserRound size={18} />
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </label>
          )}

          <label className="auth-field">
            <span>Username</span>
            <div className="field-input">
              <User size={18} />
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                required
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="field-input">
              <Lock size={18} />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </div>
          </label>

          {error && (
            <div className="auth-error">{error}</div>
          )}

          <button className="primary-btn auth-submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
            <ArrowRight size={18} />
          </button>
        </form>

        <p className="auth-footer">
          Connect. Communicate. Collaborate.
        </p>
      </div>
    </div>
  );
}
