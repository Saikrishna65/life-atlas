import React from 'react';
export default function Image({fill, priority: _priority, unoptimized: _unoptimized, quality: _quality, loader: _loader, ...props}: any) {
  return <img {...props} style={{...(fill ? {position:'absolute',inset:0,width:'100%',height:'100%'} : {}),...props.style}} />;
}
