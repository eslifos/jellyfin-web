import React, { type CSSProperties, type FC } from 'react';

import './userEditCards.scss';

interface UserEditCardProps {
    title: string;
    icon?: React.ReactNode;
    accent?: string;
    description?: string;
    className?: string;
    children: React.ReactNode;
}

/** Glass card used inside the (legacy) user edit forms; see userEditCards.scss. */
const UserEditCard: FC<UserEditCardProps> = ({ title, icon, accent = '#00a4dc', description, className, children }) => (
    <div
        className={`uecCard${className ? ` ${className}` : ''}`}
        style={{ '--uec-accent': accent, '--uec-accent2': accent === '#00a4dc' ? '#aa5cc3' : '#00a4dc' } as CSSProperties}
    >
        <div className='uecHeader'>
            {icon && <div className='uecIcon'>{icon}</div>}
            <h2 className='uecTitle'>{title}</h2>
        </div>
        {description && <div className='uecDescription'>{description}</div>}
        {children}
    </div>
);

export default UserEditCard;
