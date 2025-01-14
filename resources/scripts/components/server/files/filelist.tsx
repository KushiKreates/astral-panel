import { useState, useEffect } from 'react';
import { FileIcon, FolderIcon, LucideKeyRound, LucideFile, LucideBadgeInfo, ChevronRight, LucideFileText, LucideFileJson, LucideArchive, LucideLock,  } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import loadDirectory from '@/api/server/files/loadDirectory';
import { router } from '@inertiajs/react';
import { FileButton } from './filebuttons';
import FileEditor from './FileEditor';

interface FileManagerProps {
    serverId: string;
}

const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium'
    }).format(date);
};





const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
};

export default function FileManager({ serverId }: FileManagerProps) {
    const [files, setFiles] = useState<FileObject[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [editingFile, setEditingFile] = useState<string | null>(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('edit');
    });
    const [error, setError] = useState<string | null>(null);
    const [currentDirectory, setCurrentDirectory] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('dir') || '/';
    });
    const [selectedIndex, setSelectedIndex] = useState<number>(0);

    const mimeTypeIcons = {
        'text/plain': LucideFileText,
        'application/jar': LucideFileJson,
        'default': LucideFile,
        'application/zip': LucideArchive,
        'application/x-tar': LucideArchive,
    };

    const handleFileClick = (file: FileObject) => {
        if (!file.isFile) {
            navigateToDirectory(`${currentDirectory}/${file.name}`.replace(/\/+/g, '/'));
            return;
        }

        if (isEditable(file.mimetype)) {
            const editPath = `${currentDirectory}/${file.name}`.replace(/\/+/g, '/');
            router.visit(`?edit=${editPath}`);
            return;
        }

        setSelectedIndex(files.indexOf(file));
    };

    // Add at the start of render logic
    if (editingFile) {
        return <FileEditor serverId={serverId} file={editingFile} />;
    }
    



    const isEditable = (mimetype: string | undefined) => {
        if (!mimetype) {
            console.debug('🔍 isEditable check - mimetype is undefined');
            return false;
        }
        
        const matches = ['application/jar', 'application/octet-stream', 'inode/directory', /^image\/(?!svg\+xml)/];
        const result = matches.every((m) => !mimetype.match(m));
        
        console.debug(`🔍 isEditable check - mimetype: ${mimetype}, result: ${result}`);
        return result;
    };
    
    const getFileIcon = (file: { mimetype?: string, isFile: boolean }) => {
        if (!isEditable(file.mimetype)) {
            return <LucideLock className="h-5 w-5 text-gray-500" />;
        }
    
        if (file.mimetype.startsWith('text/plain')) {
            return <LucideFileText className="h-5 w-5 text-green-500" />;
        }
        
        for (const [type, IconComponent] of Object.entries(mimeTypeIcons)) {
            if (file.mimetype.includes(type)) {
                return <IconComponent className="h-5 w-5" />;
            }
        }
        
        return <LucideFile className="h-5 w-5" />;
    };

    const navigateToDirectory = (newPath: string) => {
        setCurrentDirectory(newPath);
        router.get(
            window.location.pathname,
            { dir: newPath },
            { preserveState: true, preserveScroll: true }
        );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(0, prev - 1));
                break;
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(files.length - 1, prev + 1));
                break;
        }
    };

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown as any);
        return () => document.removeEventListener('keydown', handleKeyDown as any);
    }, [files.length]);

    const fetchFiles = async (path: string = '/') => {
        try {
            setLoading(true);
            const files = await loadDirectory(serverId, path);
            setFiles(files.sort((a, b) => {
                if (!a.isFile && b.isFile) return -1;
                if (a.isFile && !b.isFile) return 1;
                return a.name.localeCompare(b.name);
            }));
        } catch (err) {
            setError('Failed to load directory contents');
            console.error('Error loading directory:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles(currentDirectory);
    }, [serverId, currentDirectory]);

    if (loading) {
        return (
            <div className="p-6 w-full">
                <Skeleton className="h-12 w-full mb-6 rounded-lg" />
                <div className="grid grid-cols-1 gap-3">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                </div>
            </div>
        );
    }

    const pathParts = currentDirectory === '/' ? [] : currentDirectory.split('/').filter(Boolean);

    return (
        <div className="p-6 w-full" tabIndex={0}>
            <div className="mb-6 bg-accent/30 rounded-lg p-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 flex-wrap">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer
                            ${currentDirectory === '/' ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                        onClick={() => navigateToDirectory('/')}
                    >
                        <FolderIcon className="h-4 w-4" />
                        <span className="font-medium">root</span>
                    </motion.div>

                    {pathParts.map((part, index) => (
                        <div key={index} className="flex items-center">
                            <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className={`inline-flex items-center px-3 py-1.5 rounded-md cursor-pointer
                                    ${index === pathParts.length - 1 ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}
                                onClick={() => navigateToDirectory('/' + pathParts.slice(0, index + 1).join('/'))}
                            >
                                <span className="font-medium">{part}</span>
                            </motion.div>
                        </div>
                    ))}
                </div>
            </div>

             <FileButton 
                            currentDirectory={currentDirectory} 
                            onDirectoryCreate={() => fetchFiles(currentDirectory)}
                        />

            <motion.div 
                className="grid grid-cols-1 gap-3 mt-4"
                variants={container}
                initial="hidden"
                animate="show"
            >
                {files.map((file, index) => (
                <motion.div key={file.key} variants={item}>
                    <Card 
                        className={`
                            group p-4 cursor-pointer transition-all duration-200 
                            hover:shadow-lg hover:translate-x-1
                            ${index === selectedIndex ? 
                                'bg-accent/80 ring-2 ring-primary shadow-lg' : 
                                'hover:bg-accent/40 bg-background/60'
                            }
                        `}
                        onClick={() => handleFileClick(file)}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <motion.div
                                    whileHover={{ rotate: 15, scale: 1.1 }}
                                    transition={{ type: "spring", stiffness: 400 }}
                                    className="p-2 rounded-md bg-accent/50"
                                >
                                    {file.isFile ? getFileIcon(file) : (
                                        <FolderIcon className="h-5 w-5 text-blue-500" />
                                    )}
                                </motion.div>
                                <div>
                                    <p className="font-medium">{file.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {file.isFile ? formatFileSize(file.size) : 'Click to open this directory'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-sm text-muted-foreground">
                                    {formatDate(new Date(file.modifiedAt))}
                                </p>
                                
                            </div>
                        </div>
                    </Card>
                </motion.div>
            ))}
            </motion.div>
        </div>
    );
}