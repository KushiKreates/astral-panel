import clsx from 'clsx';

interface CodeProps {
    dark?: boolean | undefined;
    className?: string;
    children: React.ReactNode;
}

export default ({ dark, className, children }: CodeProps) => (
    <code
        className={clsx('font-mono text-sm px-2 py-1 inline-block rounded w-fit', className, {
            'dark:bg-zinc-800 bg-zinc-200 ': !dark,
            'bg-zinc-900 text-zinc-100': dark,
        })}
    >
        {children}
    </code>
);
