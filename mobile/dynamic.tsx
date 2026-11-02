import React, { lazy, Suspense } from 'react';
export default function dynamic(load: () => Promise<any>, options: any = {}) {
  const Component = lazy(load);
  const Loading = options.loading;
  return function Dynamic(props: any) { return <Suspense fallback={Loading ? <Loading /> : null}><Component {...props} /></Suspense>; };
}
