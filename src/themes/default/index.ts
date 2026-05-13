import { Theme } from '../interface';

const icons = <const>[
    `🎨`,
    `🌈`,
    `⚙️`,
    `💻`,
    `📚`,
    `🐯`,
    `🐤`,
    `🐼`,
    `🐏`,
    `🍀`,
];

export type DefaultSoundNames = 'button-click' | 'triple';

export const getDefaultTheme: () => Theme<DefaultSoundNames> = () => {
    return {
        title: '中国龙2',
        desc: '真的可以通关~',
        dark: true,
        maxLevel: 20,
        backgroundColor: '#8dac85',
        icons: icons.map((icon) => ({
            name: icon,
            content: icon,
            clickSound: 'button-click',
            tripleSound: 'triple',
        })),
        sounds: [
            {
                name: 'button-click',
                src: 'https://minio.streakingman.com/solvable-sheep-game/sound-button-click.mp3',
            },
            {
                name: 'triple',
                src: 'https://minio.streakingman.com/solvable-sheep-game/sound-triple.mp3',
            },
        ],
    };
};
