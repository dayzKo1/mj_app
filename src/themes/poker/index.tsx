// 扑克牌主题
import React from 'react';
import { Theme } from '../interface';
import { DefaultSoundNames } from '../default';

const imagesUrls = import.meta.glob('./images/*.jpg', {
    import: 'default',
    eager: true,
});

const pokerCards = Object.entries(imagesUrls).map(([key, value]) => ({
    name: key.slice(9, -4),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    content: <img src={value} alt="" />,
}));

export const pokerTheme: Theme<DefaultSoundNames> = {
    title: '🃏扑克牌🃏',
    desc: '经典扑克牌主题',
    dark: true,
    maxLevel: 20,
    backgroundColor: '#1a472a',
    icons: pokerCards.map(({ name, content }) => ({
        name,
        content,
        clickSound: 'button-click',
        tripleSound: 'triple',
    })),
    sounds: [],
};
