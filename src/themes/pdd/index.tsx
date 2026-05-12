import React from 'react';
import { Theme } from '../interface';
import { DefaultSoundNames } from '../default';

const imagesUrls = import.meta.glob('./images/*.png', {
    import: 'default',
    eager: true,
});

const images = Object.entries(imagesUrls).map(([key, value]) => ({
    name: key.slice(9, -4),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    content: <img src={value} alt="" />,
}));

export const pddTheme: Theme<DefaultSoundNames> = {
    title: '🐷猪了个猪🐷',
    desc: '感谢 @猪酱的日常 提供素材',
    icons: images.map(({ name, content }) => ({
        name,
        content,
        clickSound: 'button-click',
        tripleSound: 'triple',
    })),
    sounds: [],
};
