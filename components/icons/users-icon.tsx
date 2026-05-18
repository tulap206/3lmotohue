export function UsersManagementIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Left user - head */}
      <circle cx="7" cy="6" r="2.5" />
      {/* Left user - body */}
      <path d="M4 11c0-.5.45-1 1-1h4c.55 0 1 .45 1 1v5c0 .55-.45 1-1 1H5c-.55 0-1-.45-1-1v-5z" />
      
      {/* Right user - head */}
      <circle cx="17" cy="6" r="2.5" />
      {/* Right user - body */}
      <path d="M14 11c0-.5.45-1 1-1h4c.55 0 1 .45 1 1v5c0 .55-.45 1-1 1h-4c-.55 0-1-.45-1-1v-5z" />
      
      {/* Center indicator/badge */}
      <circle cx="12" cy="19" r="1.5" opacity="0.6" />
    </svg>
  )
}
