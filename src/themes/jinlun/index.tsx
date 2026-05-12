import { Theme } from '../interface';
import React from 'react';
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

export const jinlunTheme: Theme<DefaultSoundNames> = {
    title: '🐎马了个马🐎',
    icons: icons.map(({ name, content }) => ({
        name,
        content,
        clickSound: 'button-click',
        tripleSound: 'triple',
    })),
    sounds: [],
};
