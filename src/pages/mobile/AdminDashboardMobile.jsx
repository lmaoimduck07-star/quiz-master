import React from 'react';
import MobileNavbar from '../../components/mobile/MobileNavbar';
import MobileAdminBlock from '../../components/mobile/MobileAdminBlock';

export default function AdminDashboardMobile() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <MobileNavbar title="Quản Trị" />
      <div className="pt-14">
        <MobileAdminBlock />
      </div>
    </div>
  );
}
