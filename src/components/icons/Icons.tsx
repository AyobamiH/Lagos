import React from 'react';
interface IconProps extends React.SVGProps<SVGSVGElement> { title?: string; }
function base(props: IconProps, children: React.ReactNode) {
  const { className='', title, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      role={title ? 'img':'presentation'}
      aria-label={title}
      className={`w-5 h-5 ${className}`}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}
export const HomeIcon = (p:IconProps)=> base(p, <path d="M3 11.5 12 4l9 7.5M5 10v10h14V10" />);
export const CarIcon = (p:IconProps)=> base(p,<>
  <rect x="3" y="10" width="18" height="6" rx="2" />
  <path d="M5 10l1.5-4h11L19 10" />
  <circle cx="7" cy="17" r="1.5" />
  <circle cx="17" cy="17" r="1.5" />
</>);
export const ListIcon = (p:IconProps)=> base(p,<>
  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
</>);
export const ChatIcon = (p:IconProps)=> base(p,<>
  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
</>);
export const UserIcon = (p:IconProps)=> base(p,<>
  <path d="M3 20c0-4 3-7 7-7h4c4 0 7 3 7 7" />
  <circle cx="12" cy="7" r="4" />
</>);
