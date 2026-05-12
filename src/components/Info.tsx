import React, { FC } from 'react';
import style from './Info.module.scss';
import { FixedAnimateScalePanel } from './FixedAnimateScalePanel';

export const Info: FC = () => {
    return (
        <FixedAnimateScalePanel
            className={style.info}
            openClassName={style.open}
        >
            <div className={style.icon}>i</div>
            <p>经典麻将牌三消游戏</p>
            <p>点击相同的麻将牌进行消除</p>
            <p>三个相同的麻将牌可以消除</p>
        </FixedAnimateScalePanel>
    );
};
