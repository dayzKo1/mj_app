import React, {
    FC,
    MouseEventHandler,
    useEffect,
    useRef,
    useState,
    useMemo,
    Suspense,
} from 'react';
import './Game.scss';
import {
    LAST_LEVEL_STORAGE_KEY,
    LAST_SCORE_STORAGE_KEY,
    LAST_TIME_STORAGE_KEY,
    randomString,
    resetScoreStorage,
    timestampToUsedTimeString,
    waitTimeout,
} from '../utils';
import { Icon, Theme } from '../themes/interface';
import Score from './Score';

interface MySymbol {
    id: string;
    status: number; // 0->1->2 正常->队列中->三连
    isCover: boolean;
    x: number;
    y: number;
    icon: Icon;
}
type Scene = MySymbol[];

// 随机位置、偏移量
const randomPositionOffset: (
    offsetPool: number[],
    range: number[]
) => { offset: number; row: number; column: number } = (offsetPool, range) => {
    const offset = offsetPool[Math.floor(offsetPool.length * Math.random())];
    const row = range[0] + Math.floor((range[1] - range[0]) * Math.random());
    const column = range[0] + Math.floor((range[1] - range[0]) * Math.random());
    return { offset, row, column };
};

// 制作场景：8*8虚拟网格  4*4->8*8
const sceneRanges = [
    [2, 6],
    [1, 6],
    [1, 7],
    [0, 7],
    [0, 8],
];
const offsets = [0, 25, -25, 50, -50];
const makeScene: (level: number, icons: Icon[]) => Scene = (level, icons) => {
    // 初始图标x2
    const iconPool = icons.slice(0, 2 * level);
    const offsetPool = offsets.slice(0, 1 + level);
    const scene: Scene = [];
    // 网格范围，随等级由中心扩满
    const range = sceneRanges[Math.min(4, level - 1)];
    // 在范围内随机摆放图标
    const randomSet = (icon: Icon) => {
        const { offset, row, column } = randomPositionOffset(offsetPool, range);
        scene.push({
            isCover: false,
            status: 0,
            icon,
            id: randomString(6),
            x: column * 100 + offset,
            y: row * 100 + offset,
        });
    };
    // 每间隔5级别增加icon池
    let compareLevel = level;
    while (compareLevel > 0) {
        iconPool.push(
            ...iconPool.slice(0, Math.min(10, 2 * (compareLevel - 5)))
        );
        compareLevel -= 5;
    }
    // icon池中每个生成六张卡片
    for (const icon of iconPool) {
        for (let i = 0; i < 6; i++) {
            randomSet(icon);
        }
    }
    return scene;
};

// o(n) 时间复杂度的洗牌算法
const fastShuffle: <T = any>(arr: T[]) => T[] = (arr) => {
    const res = arr.slice();
    for (let i = 0; i < res.length; i++) {
        const idx = (Math.random() * res.length) >> 0;
        [res[i], res[idx]] = [res[idx], res[i]];
    }
    return res;
};

// 洗牌
const washScene: (level: number, scene: Scene) => Scene = (level, scene) => {
    // 打乱顺序
    const updateScene = fastShuffle(scene);
    const offsetPool = offsets.slice(0, 1 + level);
    const range = sceneRanges[Math.min(4, level - 1)];
    // 重新设置位置
    const randomSet = (symbol: MySymbol) => {
        const { offset, row, column } = randomPositionOffset(offsetPool, range);
        symbol.x = column * 100 + offset;
        symbol.y = row * 100 + offset;
        symbol.isCover = false;
    };
    // 仅对仍在牌堆中的进行重置
    for (const symbol of updateScene) {
        if (symbol.status !== 0) continue;
        randomSet(symbol);
    }
    return updateScene;
};

// icon对应的组件
interface SymbolProps extends MySymbol {
    onClick: MouseEventHandler;
}
const Symbol: FC<SymbolProps> = ({ x, y, icon, isCover, status, onClick }) => {
    return (
        <div
            className="symbol"
            style={{
                transform: `translateX(${x}%) translateY(${y}%)`,
                backgroundColor: isCover ? '#999' : 'white',
                opacity: status < 2 ? 1 : 0,
            }}
            onClick={onClick}
        >
            <div
                className="symbol-inner"
                style={{ opacity: isCover ? 0.4 : 1 }}
            >
                {typeof icon.content === 'string' ? (
                    icon.content.startsWith('data:') ||
                    icon.content.startsWith('/') ||
                    icon.content.startsWith('http') ? (
                        /*图片地址*/
                        <img src={icon.content} alt="" />
                    ) : (
                        /*字符表情*/
                        <i>{icon.content}</i>
                    )
                ) : (
                    /*ReactNode*/
                    icon.content
                )}
            </div>
        </div>
    );
};

const Game: FC<{
    theme: Theme<any>;
    initLevel?: number;
    initScore?: number;
    initTime?: number;
}> = ({ theme, initLevel = 1, initScore = 0, initTime = 0 }) => {
    const maxLevel = theme.maxLevel || 50;
    const [scene, setScene] = useState<Scene>(
        makeScene(initLevel, theme.icons)
    );
    const [level, setLevel] = useState<number>(initLevel);
    const [score, setScore] = useState<number>(initScore);
    const [queue, setQueue] = useState<MySymbol[]>([]);
    const [finished, setFinished] = useState<boolean>(false);
    const [success, setSuccess] = useState<boolean>(false);
    const [animating, setAnimating] = useState<boolean>(false);

    // 场景和队列容器的 ref，用于计算位置
    const sceneRef = useRef<HTMLDivElement>(null);
    const queueRef = useRef<HTMLDivElement>(null);
    const symbolRef = useRef<HTMLDivElement>(null);
    const [queueY, setQueueY] = useState<number>(945);

    // 计算队列区域的 y 坐标
    // translateY(y%) 的百分比是相对于卡片自身的高度
    // 所以需要计算：从场景顶部到队列中心需要移动多少个"卡片高度"
    useEffect(() => {
        const calculateQueueY = () => {
            if (sceneRef.current && queueRef.current) {
                const sceneRect = sceneRef.current.getBoundingClientRect();
                const queueRect = queueRef.current.getBoundingClientRect();

                // 队列区域中心相对于场景容器顶部的像素距离
                // 减去半个卡片高度，使卡片中心对齐队列中心
                const sceneWidth = sceneRect.width;
                const symbolHeight = sceneWidth * 0.1667;

                const queueCenterY =
                    queueRect.top -
                    sceneRect.top +
                    queueRect.height / 2 -
                    symbolHeight / 2;

                // y = 需要移动的距离 / 卡片高度 * 100
                // 这样 translateY(y%) 就能正确移动到队列区域
                const y = (queueCenterY / symbolHeight) * 100;

                console.log('Queue calculation:', {
                    queueCenterY,
                    sceneWidth,
                    symbolHeight,
                    calculatedY: y,
                });

                setQueueY(y);
            }
        };

        // 延迟计算，确保 DOM 已渲染
        const timer = setTimeout(calculateQueueY, 100);
        window.addEventListener('resize', calculateQueueY);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', calculateQueueY);
        };
    }, []);

    // 队列区排序 - 使用 useMemo 确保渲染时位置已计算好
    const sortedQueue = useMemo(() => {
        // 按图标名称分组，保持入队顺序
        const cache: Record<string, MySymbol[]> = {};
        // 记录图标首次出现的顺序，确保稳定排序
        const iconOrder: string[] = [];

        for (const symbol of queue) {
            const iconName = symbol.icon.name;
            if (!cache[iconName]) {
                cache[iconName] = [];
                iconOrder.push(iconName);
            }
            cache[iconName].push(symbol);
        }

        // 按图标首次出现的顺序展开，确保相同图标连续排列
        const temp: MySymbol[] = [];
        for (const iconName of iconOrder) {
            temp.push(...cache[iconName]);
        }

        // 计算每个卡片的 x 位置
        const result: Record<string, number> = {};
        let x = 50;
        for (const symbol of temp) {
            result[symbol.id] = x;
            x += 100;
        }
        return result;
    }, [queue]);

    // 音效
    const soundRefMap = useRef<Record<string, HTMLAudioElement>>({});

    // 第一次点击时播放bgm
    const bgmRef = useRef<HTMLAudioElement>(null);
    const [bgmOn, setBgmOn] = useState<boolean>(false);
    const [once, setOnce] = useState<boolean>(false);

    useEffect(() => {
        if (!bgmRef.current) return;
        if (bgmOn) {
            bgmRef.current.volume = 0.5;
            bgmRef.current.play().then();
        } else {
            bgmRef.current.pause();
        }
    }, [bgmOn]);

    // 关卡缓存
    useEffect(() => {
        localStorage.setItem(LAST_LEVEL_STORAGE_KEY, level.toString());
        localStorage.setItem(LAST_SCORE_STORAGE_KEY, score.toString());
        localStorage.setItem(LAST_TIME_STORAGE_KEY, usedTime.toString());
    }, [level]);

    // 初始化覆盖状态
    useEffect(() => {
        checkCover(scene);
    }, []);

    // 向后检查覆盖
    const checkCover = (scene: Scene) => {
        const updateScene = scene.slice();
        for (let i = 0; i < updateScene.length; i++) {
            // 当前item对角坐标
            const cur = updateScene[i];
            cur.isCover = false;
            if (cur.status !== 0) continue;
            const { x: x1, y: y1 } = cur;
            const x2 = x1 + 100,
                y2 = y1 + 100;

            for (let j = i + 1; j < updateScene.length; j++) {
                const compare = updateScene[j];
                if (compare.status !== 0) continue;
                // 两区域有交集视为选中
                // 两区域不重叠情况取反即为交集
                const { x, y } = compare;
                if (!(y + 100 <= y1 || y >= y2 || x + 100 <= x1 || x >= x2)) {
                    cur.isCover = true;
                    break;
                }
            }
        }
        setScene(updateScene);
    };

    // 弹出
    const popTime = useRef(0);
    const pop = () => {
        if (!queue.length) return;
        const updateQueue = queue.slice();
        const symbol = updateQueue.shift();
        setScore(score - 1);
        if (!symbol) return;
        const find = scene.find((s) => s.id === symbol.id);
        if (find) {
            setQueue(updateQueue);
            find.status = 0;
            find.x = 100 * (popTime.current % 7);
            popTime.current++;
            find.y = 800;
            checkCover(scene);
            // 音效
            if (soundRefMap.current?.['sound-shift']) {
                soundRefMap.current['sound-shift'].currentTime = 0;
                soundRefMap.current['sound-shift'].play().then();
            }
        }
    };

    // 撤销
    const undo = () => {
        if (!queue.length) return;
        setScore(score - 1);
        const updateQueue = queue.slice();
        const symbol = updateQueue.pop();
        if (!symbol) return;
        const find = scene.find((s) => s.id === symbol.id);
        if (find) {
            setQueue(updateQueue);
            find.status = 0;
            checkCover(scene);
            // 音效
            if (soundRefMap.current?.['sound-undo']) {
                soundRefMap.current['sound-undo'].currentTime = 0;
                soundRefMap.current['sound-undo'].play().then();
            }
        }
    };

    // 洗牌
    const wash = () => {
        setScore(score - 1);
        checkCover(washScene(level, scene));
        // 音效
        if (soundRefMap.current?.['sound-wash']) {
            soundRefMap.current['sound-wash'].currentTime = 0;
            soundRefMap.current['sound-wash'].play().then();
        }
    };

    // 选择关卡
    const selectLevel = (newLevel: number) => {
        if (newLevel < 1 || newLevel > maxLevel) {
            return;
        }
        setScore(score - Math.abs(newLevel - level));
        setFinished(false);
        setLevel(newLevel);
        setQueue([]);
        checkCover(makeScene(newLevel, theme.icons));
    };

    // 加大难度，该方法由玩家点击下一关触发
    const levelUp = () => {
        if (level >= maxLevel) {
            return;
        }
        // 跳关扣关卡对应数值的分
        setScore(score - level);
        setFinished(false);
        setLevel(level + 1);
        setQueue([]);
        checkCover(makeScene(level + 1, theme.icons));
    };

    // 重开
    const restart = () => {
        setFinished(false);
        setSuccess(false);
        setScore(0);
        setLevel(1);
        setQueue([]);
        checkCover(makeScene(1, theme.icons));
        setUsedTime(0);
        startTimer(true);
    };

    // 点击item
    const clickSymbol = async (idx: number) => {
        if (finished || animating) return;

        // 第一次点击时，播放bgm，开启计时
        if (!once) {
            setBgmOn(true);
            setOnce(true);
            startTimer();
        }

        const updateScene = scene.slice();
        const symbol = updateScene[idx];
        if (symbol.isCover || symbol.status !== 0) return;
        symbol.status = 1;

        // 点击音效
        if (soundRefMap.current?.[symbol.icon.clickSound]) {
            soundRefMap.current[symbol.icon.clickSound].currentTime = 0;
            soundRefMap.current[symbol.icon.clickSound].play().then();
        }

        // 将点击项目加入队列
        let updateQueue = queue.slice();
        updateQueue.push(symbol);
        setQueue(updateQueue);
        checkCover(updateScene);

        // 动画锁 150ms
        setAnimating(true);
        await waitTimeout(150);

        // 查找当前队列中与点击项相同的
        const filterSame = updateQueue.filter((sb) => sb.icon === symbol.icon);

        // 后续状态判断
        // 三连了
        if (filterSame.length === 3) {
            // 三连一次+3分
            setScore(score + 3);
            updateQueue = updateQueue.filter((sb) => sb.icon !== symbol.icon);
            for (const sb of filterSame) {
                const find = updateScene.find((i) => i.id === sb.id);
                if (find) {
                    find.status = 2;
                    // 三连音效
                    if (soundRefMap.current?.[symbol.icon.tripleSound]) {
                        soundRefMap.current[
                            symbol.icon.tripleSound
                        ].currentTime = 0;
                        soundRefMap.current[symbol.icon.tripleSound]
                            .play()
                            .then();
                    }
                }
            }
        }

        // 输了
        if (updateQueue.length === 7) {
            setFinished(true);
            setSuccess(false);
        }

        if (!updateScene.find((s) => s.status !== 2)) {
            // 队列清空了
            if (level === maxLevel) {
                // 胜利
                setFinished(true);
                setSuccess(true);
            } else {
                // 升级
                // 通关奖励关卡对应数值分数
                setScore(score + level);
                setLevel(level + 1);
                setQueue([]);
                checkCover(makeScene(level + 1, theme.icons));
            }
        } else {
            // 更新队列
            setQueue(updateQueue);
            checkCover(updateScene);
        }

        setAnimating(false);
    };

    // 计时相关
    const [startTime, setStartTime] = useState<number>(0);
    const [now, setNow] = useState<number>(0);
    const [usedTime, setUsedTime] = useState<number>(initTime);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    // 结束时重置计时器和关卡信息
    useEffect(() => {
        if (finished) {
            intervalRef.current && clearInterval(intervalRef.current);
            resetScoreStorage();
        }
    }, [finished]);
    // 更新使用时间
    useEffect(() => {
        if (startTime && now) setUsedTime(now - startTime);
    }, [now]);
    // 计时器
    const startTimer = (restart?: boolean) => {
        setStartTime(Date.now() - (restart ? 0 : initTime));
        setNow(Date.now());
        intervalRef.current && clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setNow(Date.now());
        }, 10);
    };

    return (
        <>
            <div className="level">
                <div className="level-selector">
                    <label>关卡: </label>
                    <select
                        value={level}
                        onChange={(e) => selectLevel(Number(e.target.value))}
                    >
                        {Array.from({ length: maxLevel }, (_, i) => i + 1).map(
                            (l) => (
                                <option key={l} value={l}>
                                    {l}
                                </option>
                            )
                        )}
                    </select>
                </div>
                <div className="game-stats">
                    <div className="stat-item">
                        <span className="stat-label">剩余</span>
                        <span className="stat-value">
                            {scene.filter((i) => i.status === 0).length}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">得分</span>
                        <span className="stat-value">{score}</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">用时</span>
                        <span className="stat-value">
                            {timestampToUsedTimeString(usedTime)}
                        </span>
                    </div>
                </div>
            </div>
            <div className="game">
                <div className="scene-container" ref={sceneRef}>
                    <div className="scene-inner">
                        {scene.map((item, idx) => (
                            <Symbol
                                key={item.id}
                                {...item}
                                x={
                                    item.status === 0
                                        ? item.x
                                        : item.status === 1
                                        ? sortedQueue[item.id]
                                        : -1000
                                }
                                y={item.status === 0 ? item.y : queueY}
                                onClick={() => clickSymbol(idx)}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div className="queue-container" ref={queueRef} />
            <div className="flex-container flex-between">
                <button className="flex-grow" onClick={pop}>
                    弹出
                </button>
                <button className="flex-grow" onClick={undo}>
                    撤销
                </button>
                <button className="flex-grow" onClick={wash}>
                    洗牌
                </button>
                <button className="flex-grow" onClick={levelUp}>
                    下一关
                </button>
            </div>
            {/*积分、排行榜*/}
            <Suspense fallback={<span>rank list</span>}>
                {finished && (
                    <Score
                        level={level}
                        time={usedTime}
                        score={score}
                        success={success}
                        pure={theme.pure}
                        restartMethod={restart}
                    />
                )}
            </Suspense>
            {/*bgm*/}
            {theme.bgm && (
                <button className="bgm-button" onClick={() => setBgmOn(!bgmOn)}>
                    {bgmOn ? '🔊' : '🔈'}
                    <audio ref={bgmRef} loop src={theme.bgm} />
                </button>
            )}
            {/*音效*/}
            {theme.sounds.map((sound) => (
                <audio
                    key={sound.name}
                    ref={(ref) => {
                        if (ref) soundRefMap.current[sound.name] = ref;
                    }}
                    src={sound.src}
                />
            ))}
        </>
    );
};

export default Game;
