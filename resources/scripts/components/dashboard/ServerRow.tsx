import React, { Fragment, useEffect, useRef, useState } from 'react';

import { Link, usePage } from '@inertiajs/react';
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bytesToString, ip } from '@/lib/formatters';
import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerPowerState, ServerStats } from '@/api/server/getServerResourceUsage';
import { Separator } from "@/components/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import ServerStat from '../server/etc/ServerStat';

interface ServerRowProps {
    server: Server;
    className?: string;
}

const ServerRow: React.FC<ServerRowProps> = ({ server, className }) => {

    console.log(server);

    const interval = useRef<ReturnType<typeof setInterval>>(null) as React.MutableRefObject<ReturnType<typeof setInterval>>;
    const [stats, setStats] = useState<ServerStats | null>(null);
    const [isSuspended, setIsSuspended] = useState(server.status === 'suspended');
    const { props } = usePage<PageProps>();
    
    const { auth, companyDesc, AppConfig } = props;


    

    const getStats = () =>
        getServerResourceUsage(server.uuid)
            .then((data) => setStats(data))
            .catch((error) => console.error(error));

    useEffect(() => {
        setIsSuspended(stats?.isSuspended || server.status === 'suspended');
    }, [stats?.isSuspended, server.status]);

    useEffect(() => {
        if (isSuspended) return;

        getStats().then(() => {
            interval.current = setInterval(() => getStats(), 30000);
        });

        return () => {
            interval.current && clearInterval(interval.current);
        };
    }, [isSuspended]);

    const getStatusColor = (status: ServerPowerState | undefined): string => {
        if (status === 'offline') return 'bg-red-500';
        if (status === 'null') return 'bg-emerald-500';
        return 'bg-amber-500';
    };

    const hasNAStats = !stats || 
        stats.cpuUsagePercent === undefined || 
        stats.memoryUsageInBytes === undefined || 
        stats.diskUsageInBytes === undefined;

    return (
        <Card
        className={cn(
        "transition-all duration-300 cursor-pointer group rounded-2xl",
        "hover:shadow-xl hover:shadow-zinc-200/10 dark:hover:shadow-zinc-800/30",
        "relative bg-cover bg-center bg-no-repeat",
        "overflow-hidden",
        server.software_image ? `bg-[url('${server.software_image}')]` : "",
        "border border-zinc-200 dark:border-zinc-700",
        className,
        )}
        style={{
        backgroundImage: server.software_image ? `url(${server.software_image})` : "none",
        }}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/90 to-transparent pointer-events-none" />
            <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="relative flex items-center justify-center w-3 h-3">
                            <div className={cn(
                                "absolute w-2 h-2 rounded-full",
                                getStatusColor(stats?.status)
                            )} />
                            <div className={cn(
                                "absolute w-2 h-2 rounded-full animate-ping",
                                getStatusColor(stats?.status),
                                "opacity-100"
                            )} />
                        </div>
                        {/* tHIS AREA make a cape liek thing iunno bade saying that */}
                        <div className="min-w-0">
                        
                        <h3 className="text-base font-medium tracking-tight text-zinc-100 dark:text-zinc-100 truncate">
                            {server.name}
                        </h3>
                            
                            <p className="text-sm text-zinc-500 truncate">
                                {server.allocations
                                    .filter((alloc) => alloc.isDefault)
                                    .map((allocation) => (
                                        <Fragment key={allocation.ip + allocation.port.toString()}>
                                            {allocation.alias || ip(allocation.ip)}:{allocation.port}
                                        </Fragment>
                                    ))}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex gap-0">
                        <Link 
                            href={`/server/${server.id}`} 
                            className={cn(
                                "px-4 py-1.5 rounded-full text-sm font-medium mr-2",
                                "bg-zinc-200 text-zinc-900 hover:bg-zinc-300",
                                "dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
                                "transition-transform duration-300 hover:scale-105"
                            )}
                        >
                            Manage
                        </Link>
                        
                        <Link 
                            href={`/server/${server.id}/upgrade`} 
                            className={cn(
                                "px-4 py-1.5 rounded-full text-sm font-medium",
                                "bg-gradient-to-r from-amber-300 to-yellow-500",
                                "text-black hover:text-black",
                                "border-2 border-amber-400",
                                "shadow-lg hover:shadow-amber-200/50",
                                "transition-all duration-300",
                                "hover:scale-110 hover:rotate-3",
                                "[animation:pulse_3s_cubic-bezier(0.4,0,0.6,1)_infinite]"
                            )}
                        >
                            🔥 Boost
                        </Link>
                    </div>
                </div>

                <Separator className="my-4 bg-black dark:bg-zinc-200" />

                <div className="mt-4 flex items-center justify-center">
                    {hasNAStats ? (
                        <span className="text-xs text-black dark:text-zinc-200 rounded-full dark:bg-zinc-800 bg-zinc-200 px-5">Sit tight!</span>
                    ) : isSuspended || server.status ? (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ease-in-out hover:scale-[1.2]",
                                        "bg-zinc-100 text-zinc-900",
                                        "dark:bg-zinc-200 dark:text-zinc-800"
                                    )}>
                                        {isSuspended ? 'Suspended' : 
                                        server.isTransferring ? 'Transferring' :
                                        server.status === 'installing' ? 'Installing' :
                                        server.status === 'restoring_backup' ? 'Restoring Backup' :
                                        'Unavailable'}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {isSuspended ? 'Server is currently suspended' : 
                                    server.isTransferring ? 'Server is being transferred to another location' :
                                    server.status === 'installing' ? 'Server is being installed' :
                                    server.status === 'restoring_backup' ? 'Server is restoring from a backup' :
                                    'We couldn\'t retrieve the status of this server, Seems like the server is unavailable'}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <div className="grid grid-cols-3 gap-6 w-full">
                            <ServerStat 
                                label="CPU" 
                                value={`${stats.cpuUsagePercent.toFixed(2)}%`}
                                limit={server.limits.cpu}
                                type="cpu" 
                            />
                            <ServerStat 
                                label="RAM" 
                                value={bytesToString(stats.memoryUsageInBytes, 0)}
                                limit={server.limits.memory}
                                type="memory"
                            />
                            <ServerStat
                                label="Storage" 
                                value={bytesToString(stats.diskUsageInBytes, 0)}
                                limit={server.limits.disk}
                                type="disk"
                            />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};



export default ServerRow;
