import React, { FC, Suspense, useEffect, useRef, useState } from 'react';
import style from './Score.module.scss';
import Bmob from 'hydrogen-js-sdk';
import {
    PLAYING_THEME_ID_STORAGE_KEY,
    randomString,
    timestampToUsedTimeString,
    USER_ID_STORAGE_KEY,
    USER_NAME_STORAGE_KEY,
} from '../utils';
import WxQrCode from './WxQrCode';

const Fireworks = React.lazy(() => import('./Fireworks'));

interface RankInfo {
    // id
    objectId?: string;
    // 综合评分
    rating: number;
    // 通关数
    level: number;
    // 游戏得分
    score: number;
    // 主题id
    themeId: string;
    // 耗时
    time: number;
    // 用户昵称
    username: string;
    // 用户id
    userId: string;
}

// 该组件条件渲染
const Score: FC<{
    level: number;
    score: number;
    time: number;
    success: boolean;
    pure?: boolean;
    restartMethod: () => void;
}> = ({ level, score, time, success, restartMethod, pure = false }) => {
    const [rankList, setRankList] = useState<RankInfo[]>([]);
    const [username, setUsername] = useState<string>(
        localStorage.getItem(USER_NAME_STORAGE_KEY) || ''
    );
    const [userId, setUserId] = useState<string>(
        localStorage.getItem(USER_ID_STORAGE_KEY) || ''
    );
    const usernameInputRef = useRef<HTMLInputElement>(null);
    const [tip, setTip] = useState<string>('');

    // 综合评分
    const rating = Math.max(0, score) * 100 - Math.round(time / 1000);
    // 分主题排行
    const themeId = localStorage.getItem(PLAYING_THEME_ID_STORAGE_KEY);

    const uploadRankInfo = (id?: string) => {
        const _userId = localStorage.getItem(USER_ID_STORAGE_KEY);
        const _username = localStorage.getItem(USER_NAME_STORAGE_KEY);
        if (!themeId || !_userId || !_username) return;
        const rankInfo: RankInfo = {
            rating,
            themeId,
            level,
            score,
            time,
            username: _username,
            userId: _userId,
        };
        const query = Bmob.Query('rank');
        id && query.set('id', id);
        for (const [key, val] of Object.entries(rankInfo)) {
            query.set(key, val);
        }
        query
            .save()
            .then(() => {
                getRankList();
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const getRankList = (cb?: (rankList: RankInfo[]) => void) => {
        if (!themeId) return;
        const query = Bmob.Query('rank');
        query.equalTo('themeId', '==', themeId);
        query.order('-rating');
        query.limit(50);
        query
            .find()
            .then((res) => {
                setRankList(res as any);
                cb && cb(res as any);
                const _userId = localStorage.getItem(USER_ID_STORAGE_KEY);
                if (_userId) {
                    setTimeout(() => {
                        const rankEl = document.getElementById(_userId + 'el');
                        rankEl?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                        });
                    }, 1000);
                }
            })
            .catch((e) => {
                console.log(e);
            });
    };

    const onConfirmNameClick = () => {
        const inputUsername = usernameInputRef.current?.value.trim();
        if (!inputUsername) return;
        const newUserId = randomString(8);
        setUsername(inputUsername);
        setUserId(newUserId);
        localStorage.setItem(USER_NAME_STORAGE_KEY, inputUsername);
        localStorage.setItem(USER_ID_STORAGE_KEY, newUserId);
        judgeAndUpload(rankList, newUserId);
    };

    // 判断是否需要上传记录
    const judgeAndUpload = (_rankList: RankInfo[], _userId: string) => {
        if (!_userId) return;
        if (
            _rankList.length < 50 ||
            rating > _rankList[_rankList.length - 1].rating
        ) {
            // 榜未满或者分数高于榜上最后一名
            // 本次排名
            let thisRank = _rankList.findIndex((rank) => rank.rating < rating);
            if (thisRank === -1) {
                thisRank = _rankList.length + 1;
            } else {
                thisRank++;
            }
            // 查找是否曾上榜
            const findSelf = _rankList.findIndex(
                (rank) => rank.userId === _userId
            );
            if (findSelf === -1) {
                // 新上榜
                uploadRankInfo();
                setTip(`恭喜上榜！本次排名${thisRank}`);
            } else {
                if (_rankList[findSelf].rating < rating) {
                    // 破自己记录
                    uploadRankInfo(_rankList[findSelf].objectId);
                    setTip(`个人新高！本次排名${thisRank}`);
                } else if (_rankList[findSelf].rating > rating) {
                    // 没破自己记录
                    setTip(
                        `距离你的最高记录${_rankList[findSelf].rating}还差一点～`
                    );
                } else {
                    setTip(`与你的最高记录${_rankList[findSelf].rating}持平～`);
                }
            }
        } else {
            // 未上榜
            setTip('本次未上榜');
        }
    };

    useEffect(() => {
        if (!__DIY__) {
            // 排行榜
            getRankList((rankList) =>
                judgeAndUpload(
                    rankList,
                    localStorage.getItem(USER_ID_STORAGE_KEY) || ''
                )
            );
        }
    }, []);

    return (
        <div className={style.modal}>
            <Suspense
                fallback={
                    <span style={{ position: 'absolute' }}>🎆fireworks🎆</span>
                }
            >
                {success && <Fireworks />}
            </Suspense>
            <div className={style.inner}>
                {success ? <h1>恭喜通关！</h1> : <h1>挑战失败！</h1>}
                <table>
                    <thead>
                        <tr>
                            <th>通关数</th>
                            <th>用时</th>
                            <th>得分</th>
                            <th>综合评分</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{level}</td>
                            <td>{timestampToUsedTimeString(time)}</td>
                            <td>{score}</td>
                            <td>{rating}</td>
                        </tr>
                    </tbody>
                </table>

                {!__DIY__ && !username && (
                    <div className={'flex-container flex-center'}>
                        <input
                            className={style.nameInput}
                            ref={usernameInputRef}
                            maxLength={12}
                            placeholder={'留下大名进行排行榜pk!'}
                        />
                        <button
                            className={'primary'}
                            onClick={onConfirmNameClick}
                        >
                            确定
                        </button>
                    </div>
                )}

                {tip && <div>{tip}</div>}

                {__DIY__ && (
                    <button className={'primary'} onClick={restartMethod}>
                        再来一次
                    </button>
                )}

                {!__DIY__ && (
                    <div className={style.rankContainer}>
                        <h1 className={style.title}>TOP 50</h1>
                        {rankList.length ? (
                            <div className={style.list}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>名次</th>
                                            <th>名称</th>
                                            <th>通关数</th>
                                            {/*<th>用时</th>*/}
                                            {/*<th>得分</th>*/}
                                            <th>综合评分</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rankList.map((rank, idx) => (
                                            <tr
                                                key={idx}
                                                id={rank.userId + 'el'}
                                                style={{
                                                    background:
                                                        rank.userId === userId
                                                            ? 'rgb(0 0 0 / 20%)'
                                                            : '',
                                                }}
                                            >
                                                <td>{idx + 1}</td>
                                                <td className={style.username}>
                                                    {rank.username}
                                                    {rank.userId === userId &&
                                                        '(你)'}
                                                </td>
                                                <td>{rank.level}</td>
                                                {/*<td>*/}
                                                {/*    {timestampToUsedTimeString(*/}
                                                {/*        rank.time*/}
                                                {/*    )}*/}
                                                {/*</td>*/}
                                                {/*<td>{rank.score}</td>*/}
                                                <td>{rank.rating}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className={style.tip}>
                                暂无排行，速速霸榜！
                            </div>
                        )}
                        <button className={'primary'} onClick={restartMethod}>
                            再来一次
                        </button>
                    </div>
                )}
                {!pure && <WxQrCode />}
            </div>
        </div>
    );
};

export default Score;
