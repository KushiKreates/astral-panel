import React, { useState, useEffect } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from "../Layouts/AuthenticatedLayout";
import { Cog, Crown, User } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import useSWR from 'swr';
import getServers from '@/api/getServers';
import { PaginatedResult } from '@/api/http';
import { Server } from '@/api/server/getServer';
import ServerRow from '../dashboard/ServerRow';
import ServerList from './Common/ServersContainer';
import ResourceView from '../dashboard/Resource-Containers';

// Type definitions for Page Props
interface PageProps {
  auth: {
    user: {
      name: string;
      rank: string;
      pterodactyl_id: string;
    };
  };
  darkMode: boolean;
  companyDesc: string;
  AppConfig: {
    dashColor: string;
    bannerImg: string;
  };
}

export default function AdminDashboard(): JSX.Element {
  const { props } = usePage<PageProps>();
  const { auth, companyDesc, AppConfig } = props;
  const username = auth.user.username;
  const userRank = auth.user.rank;
  const [banner_clr, setBannerClr] = useState<string>(AppConfig.dashColor);
  const pterodactylId = auth.user.pterodactyl_id;

  const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString());
  const [activeProjects, setActiveProjects] = useState<number>(0);

  // Clock Update
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch Active Projects
  const { data: servers, error } = useSWR<PaginatedResult<Server>>(
    ['/api/client/'],
    () => getServers({ page: 1, perPage: 256 }) // Who knows how many server you have but there you do lmao
  );

  //console.log(servers.items.length)

  useEffect(() => {
    setBannerClr(AppConfig.dashColor);
  }, [AppConfig.dashColor]);



  useEffect(() => {
    if (servers && servers.items) {
      setActiveProjects(servers.items.length);
    }
  }, [servers]);

  if (error) {
    setActiveProjects('Error');
  }

  //console.log(activeProjects)

  // Get Rank Badge
  const getRankBadge = (): JSX.Element => {
    switch (userRank) {
      case 'admin':
        return (
          <span className="px-2 py-1 rounded-full text-xs bg-red-500 text-white flex items-center">
            <Cog className="mr-1 h-4 w-4" />
            Admin
          </span>
        );
      case 'premium':
        return (
          <span className="px-2 py-1 rounded-full text-xs bg-green-500 text-white flex items-center">
            <Crown className="mr-1 h-4 w-4" />
            Premium
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-full text-xs bg-zinc-500 text-white flex items-center">
            <User className="mr-1 h-4 w-4" />
            Hobby tier
          </span>
        );
    }
  };

  return (
    <>
    <AuthenticatedLayout
      header={
        <h2 className="text-xl font-semibold leading-tight text-gray-800 dark:text-gray-200">
          Home
        </h2>
      }
      sidebartab="home"
    >
      <Head title="Dashboard" />

      {/* Dashboard Card */}
      <Card className="w-full mb-6 overflow-hidden">
        <CardContent className="p-0">
          <div className="relative h-[160px] w-full">
            <div className={`absolute inset-0 ${banner_clr} }`} />
            <img
              src={AppConfig.bannerImg}
              alt="Dashboard Banner"
              className="absolute inset-0 w-full h-full object-cover mix-blend-overlay"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-between p-6">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-2xl font-bold font-doto dark:text-white text-white !opacity-100 mb-2">
                    Welcome back, {username}!
                  </h1>
                  <span className="dark:text-white text-2xl font-doto mb-4 z-50 text-zinc-50 !opacity-100">
                    {currentTime}
                  </span>
                  <div className="flex items-center space-x-2 mt-2">
                    {getRankBadge()}
                  </div>
                </div>
              </div>
              <div className="hidden md:flex items-center space-x-4">
                <div className="dark:text-white text-black text-right z-50 !opacity-100">
                  <p className="text-2xl font-bold font-doto">{activeProjects}</p>
                  <p className="text-xl font-bold font-doto">Active Project(s)</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resources and Servers */}
      {/*div className='h-1/6 py-4 mb-4 px-4'>
        <ResourceView/>
      </div>*/}

      <ServerList/>
      
      
    </AuthenticatedLayout>
    </>
  );

}
