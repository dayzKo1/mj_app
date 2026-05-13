import React, { FC, useEffect, useState, Suspense } from 'react';
import './App.scss';
import {
    domRelatedOptForTheme,
    LAST_LEVEL_STORAGE_KEY,
    LAST_SCORE_STORAGE_KEY,
    LAST_TIME_STORAGE_KEY,
    PLAYING_THEME_ID_STORAGE_KEY,
    resetScoreStorage,
    wrapThemeDefaultSounds,
} from './utils';
import { Theme } from './themes/interface';
import Game from './components/Game';
import { Title } from './components/Title';
import { Info } from './components/Info';
const ThemeChanger = React.lazy(() => import('./components/ThemeChanger'));
const ConfigDialog = React.lazy(() => import('./components/ConfigDialog'));
const WxQrCode = React.lazy(() => import('./components/WxQrCode'));

const App: FC<{ theme: Theme<any> }> = ({ theme: initTheme }) => {
    console.log('initTheme', initTheme);
    // console.log(JSON.stringify(theme));

    const [theme, setTheme] = useState<Theme<any>>(initTheme);
    const [diyDialogShow, setDiyDialogShow] = useState<boolean>(false);

    // 读取缓存关卡得分
    const [initLevel, setInitLevel] = useState<number>(
        Number(localStorage.getItem(LAST_LEVEL_STORAGE_KEY) || '1')
    );
    const [initScore, setInitScore] = useState<number>(
        Number(localStorage.getItem(LAST_SCORE_STORAGE_KEY) || '0')
    );
    const [initTime, setInitTime] = useState<number>(
        Number(localStorage.getItem(LAST_TIME_STORAGE_KEY) || '0')
    );

    const changeTheme = (theme: Theme<any>) => {
        localStorage.setItem(PLAYING_THEME_ID_STORAGE_KEY, theme.title);
        setInitLevel(1);
        setInitScore(0);
        setInitTime(0);
        resetScoreStorage();
        wrapThemeDefaultSounds(theme);
        domRelatedOptForTheme(theme);
        setTheme({ ...theme });
    };

    const previewTheme = (_theme: Theme<any>) => {
        const theme = JSON.parse(JSON.stringify(_theme));
        wrapThemeDefaultSounds(theme);
        domRelatedOptForTheme(theme);
        setTheme(theme);
    };

    // 生产环境才统计
    useEffect(() => {
        if (__DIY__) return;
        console.log(import.meta.env.MODE);
        if (import.meta.env.PROD) {
            const busuanziScript = document.createElement('script');
            busuanziScript.src =
                '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
            document.getElementById('root')?.appendChild(busuanziScript);
        }
    }, []);

    return (
        <>
            {theme.background && (
                <img
                    alt="background"
                    src={theme.background}
                    className="background"
                    style={{
                        filter: theme.backgroundBlur ? 'blur(8px)' : 'none',
                    }}
                />
            )}
            <div className="app-container">
                <Title title={theme.title} desc={theme.desc} />
                <div className="game-wrapper">
                    <Game
                        key={theme.title}
                        theme={theme}
                        initLevel={initLevel}
                        initScore={initScore}
                        initTime={initTime}
                    />
                </div>
                <Suspense fallback={<span>Loading</span>}>
                    {!__DIY__ && !theme.pure && <WxQrCode />}
                </Suspense>
                {!__DIY__ && (
                    <div className="footer-info">
                        <p
                            style={{
                                textAlign: 'center',
                                fontSize: 10,
                                opacity: 0.5,
                            }}
                        >
                            <span id="busuanzi_container_site_pv">
                                累计访问：
                                <span id="busuanzi_value_site_pv" />次
                            </span>
                        </p>
                        {!theme.pure && (
                            <>
                                <Info />
                                <ThemeChanger
                                    changeTheme={changeTheme}
                                    onDiyClick={() => setDiyDialogShow(true)}
                                />
                            </>
                        )}
                    </div>
                )}
                <Suspense fallback={<span>Loading</span>}>
                    {diyDialogShow && (
                        <ConfigDialog
                            closeMethod={() => setDiyDialogShow(false)}
                            previewMethod={previewTheme}
                        />
                    )}
                </Suspense>
            </div>
        </>
    );
};

export default App;
