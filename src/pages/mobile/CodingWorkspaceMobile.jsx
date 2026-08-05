import React from 'react';
import MobileNavbar from '../../components/mobile/MobileNavbar';
import MobileDevBlock from '../../components/mobile/MobileDevBlock';

export default function CodingWorkspaceMobile() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <MobileNavbar title="Lập Trình" />
      <div className="pt-14">
        <MobileDevBlock feature="Không gian Lập trình" />
      </div>
    </div>
  );
}
