import { useState, useEffect } from 'react';
import { Head } from '@inertiajs/react';
import { usePage } from '@inertiajs/react';
import ServerLayout from '@/components/Layouts/ServerLayout';
import PowerButtons from '@/components/server/console/PowerButtons';
import getServerResourceUsage from '@/api/server/getServerResourceUsage';
import OverviewServerCard from '@/components/server/Overview';
import ServerSpecifications from '@/components/server/console/SystemSpecs';
import ResourceUsage, { ResourceUsageCards } from '@/components/server/console/ServerDetailsSpedo';
import StatCharts from '@/components/server/console/StatGraphs';
import { Toaster } from "@/components/ui/toaster"

interface ServerPageProps {
    server: {
        uuid: string;
        name: string;
        identifier: string;
    }
}

export default function Show() {
    const { server, auth } = usePage<ServerPageProps>().props;
    const [serverStatus, setServerStatus] = useState<string | null>(null);
    const [isNodeOffline, setIsNodeOffline] = useState(false);

    useEffect(() => {
        const fetchStats = () => {
            getServerResourceUsage(server.uuid)
                .then(data => {
                    console.table(data);
                    setServerStatus(data.status);
                    setIsNodeOffline(false);
                })
                .catch(error => {
                    console.error(error);
                    setIsNodeOffline(true);
                });
        };

        fetchStats();
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, [server.uuid]);

    console.log(usePage<ServerPageProps>().props);

    //fixxses

    return (
        <ServerLayout 
            serverId={server.identifier}
            serverName={`Server / ${server.name} / Utilization`}
            sidebarTab="stats"
        >
            <Head title={`${server.name} - Utilization`} />
            
            <div className="p-4 space-y-4">
                <PowerButtons 
                    serverId={server.uuid}
                    status={serverStatus}
                    disabled={isNodeOffline}
                    className="mb-4" 
                />
                <Toaster />

                <StatCharts serverId={server.identifier} />
                
                
                <ResourceUsage/>
                <ServerSpecifications/>
            </div>
        </ServerLayout>
    );
}