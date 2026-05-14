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
    rowRange: number[],
    columnRange: number[]
) => { offset: number; row: number; column: number } = (
    offsetPool,
    rowRange,
    columnRange
) => {
    const offset = offsetPool[Math.floor(offsetPool.length * Math.random())];
    const row =
        rowRange[0] + Math.floor((rowRange[1] - rowRange[0]) * Math.random());
    const column =
        columnRange[0] +
        Math.floor((columnRange[1] - columnRange[0]) * Math.random());
    return { offset, row, column };
};

// 制作场景：网格布局
// X轴：每列占容器宽度的 12.5%（8列 = 100%）
// Y轴：每行占容器高度的 25%
// offset 可能是负数，所以 column/row 最小值要保证加上 offset 后 >= 0
// offset 最小 = -0.5，对应偏移 -6.25%，所以 column/row 最小值 >= 0.5
const columnRanges = [
    [1.5, 5.5], // 关卡1：x = 18.75% 到 68.75%
    [1, 6],
    [0.5, 6],
    [0.5, 6],
    [0.5, 6],
];
const rowRanges = [
    [1, 3.2], // 关卡1：y = 25% 到 80%
    [0.5, 3],
    [0.5, 3.2],
    [0.5, 3.3],
    [0.5, 3.3],
];
// offset 是卡片宽度的百分比（用于微调位置，让卡片稍微错开）
// 卡片宽度是容器的 12.5%，offset 会乘以 12.5 加到位置上
// 所以 offset 值要小，避免超出容器
// offset 最大 0.8，偏移 10% 容器宽度
const offsets = [0, 0.3, -0.3, 0.5, -0.5];
const makeScene: (level: number, icons: Icon[]) => Scene = (level, icons) => {
    // 初始图标x2
    const iconPool = icons.slice(0, 2 * level);
    const offsetPool = offsets.slice(0, 1 + level);
    const scene: Scene = [];
    // 网格范围，随等级由中心扩满
    const levelIndex = Math.min(4, level - 1);
    const columnRange = columnRanges[levelIndex];
    const rowRange = rowRanges[levelIndex];
    // 在范围内随机摆放图标
    const randomSet = (icon: Icon) => {
        const { offset, row, column } = randomPositionOffset(
            offsetPool,
            rowRange,
            columnRange
        );
        // x: 容器宽度的百分比，每列 12.5%
        // y: 容器高度的百分比，每行约 25%
        // 卡片宽度 12.5%，高度约 22.7%（相对容器高度）
        // 确保不超出容器边界：
        // x >= 0, x <= 87.5%
        // y >= 0, y <= 77%（100% - 卡片高度）
        const rawX = column * 12.5 + offset * 12.5;
        const rawY = row * 25 + offset * 12.5;
        const maxX = 87.5; // 100% - 卡片宽度
        const maxY = 77; // 100% - 卡片高度（约22.7%）
        scene.push({
            isCover: false,
            status: 0,
            icon,
            id: randomString(6),
            x: Math.max(0, Math.min(maxX, rawX)),
            y: Math.max(0, Math.min(maxY, rawY)),
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
    const levelIndex = Math.min(4, level - 1);
    const columnRange = columnRanges[levelIndex];
    const rowRange = rowRanges[levelIndex];
    // 重新设置位置
    const randomSet = (symbol: MySymbol) => {
        const { offset, row, column } = randomPositionOffset(
            offsetPool,
            rowRange,
            columnRange
        );
        // x: 容器宽度的百分比，每列 12.5%
        // y: 容器高度的百分比，每行约 25%
        // 卡片宽度 12.5%，高度约 22.7%
        // 确保不超出容器边界：
        // x >= 0, x <= 87.5%
        // y >= 0, y <= 77%
        const rawX = column * 12.5 + offset * 12.5;
        const rawY = row * 25 + offset * 12.5;
        const maxX = 87.5;
        const maxY = 77;
        symbol.x = Math.max(0, Math.min(maxX, rawX));
        symbol.y = Math.max(0, Math.min(maxY, rawY));
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
                left: `${x}%`,
                top: `${y}%`,
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
    const [autoPlay, setAutoPlay] = useState<boolean>(false);
    const autoPlayRef = useRef<boolean>(false);

    // 场景和队列容器的 ref，用于计算位置
    const sceneRef = useRef<HTMLDivElement>(null);
    const queueRef = useRef<HTMLDivElement>(null);
    const symbolRef = useRef<HTMLDivElement>(null);
    const [queueY, setQueueY] = useState<number>(945);

    // 计算队列区域的 y 坐标
    // 卡片使用 left(x%) top(y%) 定位，百分比相对于 scene-inner（即 scene-container）
    // queue-container 在 scene-container 下方，scene-inner 有 overflow:visible，卡片可以超出
    useEffect(() => {
        const calculateQueueY = () => {
            if (!sceneRef.current || !queueRef.current) return;

            const sceneContainer =
                sceneRef.current.querySelector('.scene-container');
            if (!sceneContainer) return;

            const sceneContainerRect = sceneContainer.getBoundingClientRect();
            const queueRect = queueRef.current.getBoundingClientRect();

            // queue-container 中心相对于 scene-container 顶部的像素距离
            const queueCenterY =
                queueRect.top - sceneContainerRect.top + queueRect.height / 2;

            // 卡片高度 = sceneContainer 宽度 * 12.5% * 4/3（padding-bottom 相对于宽度）
            const cardHeightPixels = sceneContainerRect.width * 0.125 * (4 / 3);

            // 让卡片中心对齐 queue-container 中心：top = queueCenter - cardHeight/2
            const cardTopY = queueCenterY - cardHeightPixels / 2;

            // y = 距离 / scene-container 高度 * 100（百分比）
            const y = Math.max(0, (cardTopY / sceneContainerRect.height) * 100);

            setQueueY(y);
        };

        // 延迟计算，确保 DOM 已渲染
        const timer = setTimeout(calculateQueueY, 100);
        window.addEventListener('resize', calculateQueueY);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', calculateQueueY);
        };
    }, [level]);

    // 队列区排序 - 使用 useMemo 确保渲染时位置已计算好
    // 队列中卡片宽度 12.5%，间隔约 1%，总共最多 7 张卡片
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

        // 计算每个卡片的 x 位置（百分比）
        // 队列容器宽度 100%，卡片宽度 12.5%，最多 7 张卡片 = 87.5%
        // 第一张卡片居中偏左：x = (100 - 87.5) / 2 = 6.25%
        // 每张卡片间隔约 1%
        const CARD_WIDTH = 12.5;
        const GAP = 1;
        const result: Record<string, number> = {};
        let x =
            (100 - (temp.length * CARD_WIDTH + (temp.length - 1) * GAP)) / 2;
        for (const symbol of temp) {
            result[symbol.id] = x;
            x += CARD_WIDTH + GAP;
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
    // 卡片尺寸：宽度 12.5% 容器宽度，高度 16.67% 容器高度
    const SYMBOL_WIDTH = 12.5;
    const SYMBOL_HEIGHT = 16.67;
    const checkCover = (scene: Scene) => {
        const updateScene = scene.slice();
        for (let i = 0; i < updateScene.length; i++) {
            // 当前item对角坐标（百分比）
            const cur = updateScene[i];
            cur.isCover = false;
            if (cur.status !== 0) continue;
            const { x: x1, y: y1 } = cur;
            const x2 = x1 + SYMBOL_WIDTH;
            const y2 = y1 + SYMBOL_HEIGHT;

            for (let j = i + 1; j < updateScene.length; j++) {
                const compare = updateScene[j];
                if (compare.status !== 0) continue;
                // 两区域有交集视为选中
                // 两区域不重叠情况取反即为交集
                const { x, y } = compare;
                if (
                    !(
                        y + SYMBOL_HEIGHT <= y1 ||
                        y >= y2 ||
                        x + SYMBOL_WIDTH <= x1 ||
                        x >= x2
                    )
                ) {
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

    /** AI寻找最佳下一步 */
    const findBestMove = (): number | null => {
        const availableCards = scene.filter(
            (card) => card.status === 0 && !card.isCover
        );
        if (availableCards.length === 0) return null;

        const slotIconCount: Record<string, number> = {};
        queue.forEach((s) => {
            slotIconCount[s.icon.name] = (slotIconCount[s.icon.name] || 0) + 1;
        });

        let bestIndex: number | null = null;
        let bestScore = -Infinity;

        availableCards.forEach((card) => {
            const idx = scene.findIndex((c) => c.id === card.id);
            const currentInSlot = slotIconCount[card.icon.name] || 0;
            let score = 0;

            if (currentInSlot === 2) score += 1000;
            else if (currentInSlot === 1) score += 100;
            else score += 10;

            const remainingInScene = scene.filter(
                (c) => c.status === 0 && c.icon.name === card.icon.name
            ).length;
            if (remainingInScene >= 2) score += 30;

            if (queue.length >= 5 && currentInSlot === 0) score -= 50;

            if (score > bestScore) {
                bestScore = score;
                bestIndex = idx;
            }
        });

        return bestIndex;
    };

    /** 开始AI自动闯关 */
    const startAutoPlay = async () => {
        autoPlayRef.current = true;
        setAutoPlay(true);

        if (!once) {
            setBgmOn(true);
            setOnce(true);
            startTimer();
        }

        while (autoPlayRef.current && !finished) {
            if (animating) {
                await waitTimeout(100);
                continue;
            }

            const bestMove = findBestMove();
            if (bestMove !== null) {
                await clickSymbol(bestMove);
            } else {
                if (score > 0) {
                    wash();
                    await waitTimeout(500);
                } else {
                    autoPlayRef.current = false;
                    setAutoPlay(false);
                    break;
                }
            }

            await waitTimeout(400);
        }
    };

    /** 停止AI自动闯关 */
    const stopAutoPlay = () => {
        autoPlayRef.current = false;
        setAutoPlay(false);
    };

    return (
        <>
            <div className="level">
                <div className="game-stats">
                    <div className="stat-item">
                        <span className="stat-label">关卡</span>
                        <span className="stat-value">
                            <select
                                value={level}
                                onChange={(e) =>
                                    selectLevel(Number(e.target.value))
                                }
                            >
                                {Array.from(
                                    { length: maxLevel },
                                    (_, i) => i + 1
                                ).map((l) => (
                                    <option key={l} value={l}>
                                        {l}
                                    </option>
                                ))}
                            </select>
                        </span>
                    </div>
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
            <div className="game" ref={sceneRef}>
                <div className="scene-container">
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
                <div className="queue-container" ref={queueRef} />
                <div className="button-container flex-container flex-between">
                    <button className="flex-grow" onClick={pop}>
                        弹出
                    </button>
                    <button className="flex-grow" onClick={undo}>
                        撤销
                    </button>
                    <button
                        className={`flex-grow ${
                            autoPlay ? 'auto-playing' : ''
                        }`}
                        onClick={autoPlay ? stopAutoPlay : startAutoPlay}
                    >
                        {autoPlay ? '停止AI' : 'AI自动'}
                    </button>
                    <button className="flex-grow" onClick={wash}>
                        洗牌
                    </button>
                    <button className="flex-grow" onClick={levelUp}>
                        下一关
                    </button>
                </div>
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
