import { User } from '../hooks/useFileSystem'
import './UserPresence.css'

interface UserPresenceProps {
  users: User[]
  current_user: User | null
}

export default function UserPresence({ users, current_user }: UserPresenceProps) {
  if (users.length === 0) return null

  return (
    <div className="user-presence">
      <div className="user-avatars">
        {users.map((user, index) => (
          <div
            key={user.id}
            className={`user-avatar ${user.id === current_user?.id ? 'is-you' : ''}`}
            style={{
              backgroundColor: user.color,
              zIndex: users.length - index,
            }}
            title={`${user.name} (${user.role})${user.id === current_user?.id ? ' - you' : ''}`}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
      <span className="user-count">
        {users.length} {users.length === 1 ? 'user' : 'users'}
      </span>
    </div>
  )
}
