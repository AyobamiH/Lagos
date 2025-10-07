import React from 'react';
export const SkipLink: React.FC = () => (
  <a href="#main" style={{position:'absolute',left:-9999,top:-9999,background:'#000',color:'#fff',padding:'8px'}}
     onFocus={e=>{e.currentTarget.style.left='8px'; e.currentTarget.style.top='8px';}}
     onBlur={e=>{e.currentTarget.style.left='-9999px'; e.currentTarget.style.top='-9999px';}}
  >Skip to content</a>
);
export default SkipLink;