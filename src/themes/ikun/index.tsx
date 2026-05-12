import React from 'react';
import { Theme } from '../interface';
import { DefaultSoundNames } from '../default';

const imagesUrls = import.meta.glob('./images/*.png', {
    import: 'default',
    eager: true,
});

const icons = Object.entries(imagesUrls).map(([key, value]) => ({
    name: key.slice(9, -4),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    content: <img src={value} alt="" />,
}));

export const ikunTheme: Theme<DefaultSoundNames> = {
    title: '🐔鸡了个鸡🐔',
    icons: icons.map(({ name, content }) => ({
        name,
        content,
        clickSound: 'button-click',
        tripleSound: 'triple',
    })),
    sounds: [],
};
