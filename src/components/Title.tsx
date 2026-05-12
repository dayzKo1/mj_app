import React, { FC } from 'react';
import style from './Title.module.scss';

export const Title: FC<{ title: string; desc?: string }> = ({
    title,
    desc,
}) => {
    return (
        <>
            <h1 className={style.title}>{title}</h1>
            {desc && <h2 className={style.description}>{desc}</h2>}
        </>
    );
};
