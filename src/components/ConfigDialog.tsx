import React, { FC, ReactNode, useEffect, useState } from 'react';
import style from './ConfigDialog.module.scss';
import classNames from 'classnames';
import { Icon, Sound, Theme } from '../themes/interface';
import { QRCodeCanvas } from 'qrcode.react';
import Bmob from 'hydrogen-js-sdk';
import {
    captureElement,
    CUSTOM_THEME_FILE_VALIDATE_STORAGE_KEY,
    LAST_CUSTOM_THEME_ID_STORAGE_KEY,
    CUSTOM_THEME_STORAGE_KEY,
    deleteThemeUnusedSounds,
    getFileBase64String,
    linkReg,
    randomString,
    wrapThemeDefaultSounds,
    LAST_UPLOAD_TIME_STORAGE_KEY,
    canvasToFile,
    createCanvasByImgSrc,
} from '../utils';
import { copy } from 'clipboard';
import { CloseIcon } from './CloseIcon';
import WxQrCode from './WxQrCode';

const InputContainer: FC<{
    label: string;
    required?: boolean;
    children?: ReactNode;
}> = ({ label, children, required }) => {
    return (
        <>
            <div className={style.divider} />
            <div
                className={classNames(
                    'flex-container flex-center flex-no-wrap',
                    style.inputContainer,
                    required && style.required
                )}
            >
                <span className={style.label}>{label}</span>
                <div className={'flex-container flex-column flex-grow'}>
                    {children}
                </div>
            </div>
        </>
    );
};

interface CustomIcon extends Icon {
    content: string;
}

interface CustomTheme extends Theme<any> {
    icons: CustomIcon[];
}

const ConfigDialog: FC<{
    closeMethod: () => void;
    previewMethod: (theme: Theme<string>) => void;
}> = ({ closeMethod, previewMethod }) => {
    // 错误提示
    const [configError, setConfigError] = useState<string>('');
    // 生成链接
    const [genLink, setGenLink] = useState<string>('');

    // 主题大对象
    const [customTheme, setCustomTheme] = useState<CustomTheme>({
        title: '',
        sounds: [],
        pure: false,
        icons: new Array(10).fill(0).map(() => ({
            name: randomString(4),
            content: '',
            clickSound: '',
            tripleSound: '',
        })),
    });
    function updateCustomTheme(key: keyof CustomTheme, value: any) {
        if (['sounds', 'icons'].includes(key)) {
            if (Array.isArray(value)) {
                setCustomTheme({
                    ...customTheme,
                    [key]: [...value],
                });
            } else {
                setCustomTheme({
                    ...customTheme,
                    [key]: [...customTheme[key as 'sounds' | 'icons'], value],
                });
            }
        } else {
            setCustomTheme({
                ...customTheme,
                [key]: value,
            });
        }
    }
    useEffect(() => {
        console.log(customTheme);
    }, [customTheme]);

    // 音效
    const [newSound, setNewSound] = useState<Sound>({ name: '', src: '' });
    const [soundError, setSoundError] = useState<string>('');
    const onNewSoundChange = (key: keyof Sound, value: string) => {
        setNewSound({
            ...newSound,
            [key]: value,
        });
    };
    const onAddNewSoundClick = () => {
        setSoundError('');
        let error = '';
        if (!linkReg.test(newSound.src)) error = '请输入https链接';
        if (!newSound.name) error = '请输入音效名称';
        if (customTheme.sounds.find((s) => s.name === newSound.name))
            error = '名称已存在';
        if (error) {
            setSoundError(error);
        } else {
            updateCustomTheme('sounds', newSound);
            setNewSound({ name: '', src: '' });
        }
    };
    const onDeleteSoundClick = (idx: number) => {
        const deleteSoundName = customTheme.sounds[idx].name;
        const findIconUseIdx = customTheme.icons.findIndex(
            ({ clickSound, tripleSound }) =>
                [clickSound, tripleSound].includes(deleteSoundName)
        );
        if (findIconUseIdx !== -1) {
            return setSoundError(
                `第${findIconUseIdx + 1}项图标有使用该音效，请取消后再删除`
            );
        }

        const newSounds = customTheme.sounds.slice();
        newSounds.splice(idx, 1);
        updateCustomTheme('sounds', newSounds);
    };

    // 本地文件选择
    const [bgmError, setBgmError] = useState<string>('');
    const [backgroundError, setBackgroundError] = useState<string>('');
    const [iconErrors, setIconErrors] = useState<string[]>(
        new Array(10).fill('')
    );
    // 文件体积校验开关
    const initEnableFileSizeValidate = localStorage.getItem(
        CUSTOM_THEME_FILE_VALIDATE_STORAGE_KEY
    );
    const [enableFileSizeValidate, setEnableFileSizeValidate] =
        useState<boolean>(
            initEnableFileSizeValidate === null
                ? true
                : initEnableFileSizeValidate === 'true'
        );
    useEffect(() => {
        localStorage.setItem(
            CUSTOM_THEME_FILE_VALIDATE_STORAGE_KEY,
            enableFileSizeValidate + ''
        );
    }, [enableFileSizeValidate]);
    const makeIconErrors = (idx: number, error: string) =>
        new Array(10)
            .fill('')
            .map((item, _idx) => (idx === _idx ? error : iconErrors[_idx]));
    const onFileChange: (props: {
        type: 'bgm' | 'background' | 'sound' | 'icon';
        file?: File;
        idx?: number;
    }) => void = async ({ type, file, idx }) => {
        if (!file) return;
        switch (type) {
            case 'bgm':
                setBgmError('');
                if (enableFileSizeValidate && file.size > 80 * 1024) {
                    return setBgmError('请选择80k以内全损音质的文件');
                }
                getFileBase64String(file)
                    .then((res) => {
                        updateCustomTheme('bgm', res);
                    })
                    .catch((e) => {
                        setBgmError(e);
                    });
                break;
            case 'background':
                setBackgroundError('');
                try {
                    const _file = enableFileSizeValidate
                        ? await canvasToFile({
                              canvas: await createCanvasByImgSrc({
                                  imgSrc: await getFileBase64String(file),
                              }),
                              maxFileSize: 20 * 1024,
                          })
                        : file;
                    const fileBase64 = await getFileBase64String(_file);
                    updateCustomTheme('background', fileBase64);
                } catch (e: any) {
                    setBackgroundError(e);
                }
                break;
            case 'sound':
                setSoundError('');
                if (enableFileSizeValidate && file.size > 10 * 1024) {
                    return setSoundError('请选择10k以内的音频文件');
                }
                getFileBase64String(file)
                    .then((res) => {
                        onNewSoundChange('src', res);
                    })
                    .catch((e) => {
                        setSoundError(e);
                    });
                break;
            case 'icon':
                if (idx == null) return;
                setIconErrors(makeIconErrors(idx, ''));
                try {
                    const _file = enableFileSizeValidate
                        ? await canvasToFile({
                              canvas: await createCanvasByImgSrc({
                                  imgSrc: await getFileBase64String(file),
                              }),
                              maxFileSize: 4 * 1024,
                          })
                        : file;
                    const fileBase64 = await getFileBase64String(_file);
                    updateCustomTheme(
                        'icons',
                        customTheme.icons.map((icon, _idx) =>
                            _idx === idx
                                ? { ...icon, content: fileBase64 }
                                : icon
                        )
                    );
                } catch (e: any) {
                    setIconErrors(makeIconErrors(idx, e));
                }
                break;
        }
    };

    // 图标更新
    const updateIcons = (key: keyof CustomIcon, value: string, idx: number) => {
        const newIcons = customTheme.icons.map((icon, _idx) =>
            _idx === idx
                ? {
                      ...icon,
                      [key]: value,
                  }
                : icon
        );
        updateCustomTheme('icons', newIcons);
    };

    // 初始化
    useEffect(() => {
        const lastId = localStorage.getItem(LAST_CUSTOM_THEME_ID_STORAGE_KEY);
        lastId && setGenLink(`${location.origin}?customTheme=${lastId}`);
        try {
            const configString = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
            if (configString) {
                const parseRes = JSON.parse(configString);
                if (typeof parseRes === 'object') {
                    setTimeout(() => {
                        setCustomTheme(parseRes);
                    }, 300);
                }
            }
        } catch (e) {
            console.log(e);
        }
    }, []);

    // 校验主题
    const validateTheme: () => Promise<string> = async () => {
        // 校验
        if (!customTheme.title) return Promise.reject('请输入标题');
        if (customTheme.bgm && !linkReg.test(customTheme.bgm))
            return Promise.reject('bgm请输入https链接');
        if (customTheme.background && !linkReg.test(customTheme.background))
            return Promise.reject('背景图请输入https链接');
        if (!customTheme.maxLevel || customTheme.maxLevel < 5)
            return Promise.reject('请输入大于5的关卡数');
        const findIconError = iconErrors.find((i) => !!i);
        if (findIconError)
            return Promise.reject(`图标素材有错误：${findIconError}`);
        const findUnfinishedIconIdx = customTheme.icons.findIndex(
            (icon) => !icon.content
        );
        if (findUnfinishedIconIdx !== -1) {
            setIconErrors(makeIconErrors(findUnfinishedIconIdx, '请填写链接'));
            return Promise.reject(
                `第${findUnfinishedIconIdx + 1}图标素材未完成`
            );
        }

        return Promise.resolve('');
    };

    // 预览
    const onPreviewClick = () => {
        setConfigError('');
        validateTheme()
            .then(() => {
                const cloneTheme = JSON.parse(JSON.stringify(customTheme));
                wrapThemeDefaultSounds(cloneTheme);
                previewMethod(cloneTheme);
                localStorage.setItem(
                    CUSTOM_THEME_STORAGE_KEY,
                    JSON.stringify(customTheme)
                );
                closeMethod();
            })
            .catch((e) => {
                setConfigError(e);
            });
    };

    // 生成二维码和链接
    const [uploading, setUploading] = useState<boolean>(false);
    const onGenQrLinkClick = () => {
        if (uploading) return;
        if (!enableFileSizeValidate)
            return setConfigError('请先开启文件大小校验');
        let passTime = Number.MAX_SAFE_INTEGER;
        const lastUploadTime = localStorage.getItem(
            LAST_UPLOAD_TIME_STORAGE_KEY
        );
        if (lastUploadTime) {
            passTime = Date.now() - Number(lastUploadTime);
        }
        if (passTime < 1000 * 60 * 15) {
            return setConfigError(
                `为节省请求数，15分钟内只能生成一次二维码，还剩大约${
                    15 - Math.round(passTime / 1000 / 60)
                }分钟，先本地预览调整下吧～`
            );
        }
        setUploading(true);
        setConfigError('');
        validateTheme()
            .then(() => {
                const cloneTheme = JSON.parse(JSON.stringify(customTheme));
                deleteThemeUnusedSounds(cloneTheme);
                const stringify = JSON.stringify(cloneTheme);
                localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, stringify);
                const query = Bmob.Query('config');
                query.set('content', stringify);
                query
                    .save()
                    .then((res) => {
                        localStorage.setItem(
                            LAST_CUSTOM_THEME_ID_STORAGE_KEY,
                            //@ts-ignore
                            res.objectId
                        );
                        localStorage.setItem(
                            LAST_UPLOAD_TIME_STORAGE_KEY,
                            Date.now().toString()
                        );
                        setTimeout(() => {
                            setGenLink(
                                `${location.origin}?customTheme=${
                                    /*@ts-ignore*/
                                    res.objectId || id
                                }`
                            );
                        }, 3000);
                    })
                    .catch(({ error, code }) => {
                        setTimeout(() => {
                            setConfigError(error);
                        }, 3000);
                    })
                    .finally(() => {
                        setTimeout(() => {
                            setUploading(false);
                        }, 3000);
                    });
            })
            .catch((e) => {
                setConfigError(e);
                setUploading(false);
            });
    };

    // 彩蛋
    const [pureClickTime, setPureClickTime] = useState<number>(0);
    useEffect(() => {
        updateCustomTheme(
            'pure',
            pureClickTime % 5 === 0 && pureClickTime !== 0
        );
    }, [pureClickTime]);

    return (
        <div className={classNames(style.dialog)}>
            <div className={style.closeBtn} onClick={closeMethod}>
                <CloseIcon fill={'#fff'} />
            </div>
            <h2>自定义主题</h2>

            <InputContainer label={'标题'} required>
                <input
                    placeholder={'请输入标题'}
                    value={customTheme.title}
                    onChange={(e) => updateCustomTheme('title', e.target.value)}
                />
            </InputContainer>
            <InputContainer label={'描述'}>
                <input
                    placeholder={'请输入描述'}
                    value={customTheme.desc || ''}
                    onChange={(e) => updateCustomTheme('desc', e.target.value)}
                />
            </InputContainer>
            <InputContainer label={'BGM'}>
                <div className={style.tip}>
                    接口上传体积有限制，上传文件请全力压缩到80k以下，推荐使用外链
                </div>
                <input
                    type={'file'}
                    accept={'.mp3'}
                    onChange={(e) =>
                        onFileChange({
                            type: 'bgm',
                            file: e.target.files?.[0],
                        })
                    }
                />
                {bgmError && <div className={style.errorTip}>{bgmError}</div>}
                <input
                    placeholder={'或者输入https外链'}
                    value={customTheme.bgm || ''}
                    onChange={(e) => updateCustomTheme('bgm', e.target.value)}
                />
                {customTheme.bgm && <audio src={customTheme.bgm} controls />}
            </InputContainer>
            <InputContainer label={'背景图'}>
                <div className={style.tip}>
                    接口上传体积有限制，上传的图片将会被严重压缩，推荐使用外链
                </div>
                <input
                    type={'file'}
                    accept={'.jpg,.png,.gif'}
                    onChange={(e) =>
                        onFileChange({
                            type: 'background',
                            file: e.target.files?.[0],
                        })
                    }
                />
                {backgroundError && (
                    <div className={style.errorTip}>{backgroundError}</div>
                )}
                <div className={'flex-container flex-center'}>
                    <input
                        placeholder={'或者输入https外链'}
                        value={customTheme.background || ''}
                        onChange={(e) =>
                            updateCustomTheme('background', e.target.value)
                        }
                    />
                    {customTheme.background && (
                        <img
                            alt="加载失败"
                            src={customTheme.background}
                            className={style.imgPreview}
                        />
                    )}
                </div>
                <div className={'flex-container flex-center flex-wrap'}>
                    <div className={'flex-spacer flex-container flex-center'}>
                        <span>毛玻璃</span>
                        <input
                            type={'checkbox'}
                            checked={!!customTheme.backgroundBlur}
                            onChange={(e) =>
                                updateCustomTheme(
                                    'backgroundBlur',
                                    e.target.checked
                                )
                            }
                        />
                    </div>
                    <div className={'flex-spacer flex-container flex-center'}>
                        <span>深色</span>
                        <input
                            type={'checkbox'}
                            checked={!!customTheme.dark}
                            onChange={(e) =>
                                updateCustomTheme('dark', e.target.checked)
                            }
                        />
                    </div>
                    <div className={'flex-spacer flex-container flex-center'}>
                        <span>纯色</span>
                        <input
                            type={'color'}
                            value={customTheme.backgroundColor || '#ffffff'}
                            onChange={(e) =>
                                updateCustomTheme(
                                    'backgroundColor',
                                    e.target.value
                                )
                            }
                        />
                    </div>
                </div>
                <div className={style.tip}>
                    使用图片或者纯色作为背景，图片可开启毛玻璃效果。如果你使用了深色的图片和颜色，请开启深色模式，此时标题等文字将变为亮色
                </div>
            </InputContainer>
            <InputContainer label={'关卡数'} required>
                <input
                    type={'number'}
                    placeholder={'最低5关，最高...理论上无限'}
                    value={customTheme.maxLevel || ''}
                    onChange={(e) =>
                        updateCustomTheme('maxLevel', Number(e.target.value))
                    }
                />
            </InputContainer>
            <InputContainer label={'音效素材'}>
                <div className={'flex-container flex-left-center'}>
                    {customTheme.sounds.map((sound, idx) => {
                        return (
                            <div key={sound.name} className={style.soundItem}>
                                <audio src={sound.src} controls />
                                <div className={style.inner}>
                                    <span>{sound.name}</span>
                                    <CloseIcon
                                        fill={'#fff'}
                                        onClick={() => onDeleteSoundClick(idx)}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <input
                    placeholder={'输入音效名称'}
                    value={newSound.name}
                    onChange={(e) => onNewSoundChange('name', e.target.value)}
                />
                <div className={style.tip}>
                    接口上传体积有限制，上传文件请全力压缩到10k以下，推荐使用外链
                </div>
                <input
                    type={'file'}
                    accept={'.mp3'}
                    onChange={(e) =>
                        onFileChange({
                            type: 'sound',
                            file: e.target.files?.[0],
                        })
                    }
                />
                <input
                    placeholder={'或者输入https外链'}
                    value={newSound.src}
                    onChange={(e) => onNewSoundChange('src', e.target.value)}
                />
                {soundError && (
                    <div className={style.errorTip}>{soundError}</div>
                )}
                <button onClick={onAddNewSoundClick}>添加音效</button>
            </InputContainer>
            <InputContainer label={'图标素材'} required>
                <div className={style.tip}>
                    接口上传体积有限制，上传的图片将会被严重压缩，推荐使用外链
                </div>
            </InputContainer>
            {customTheme.icons.map((icon, idx) => (
                <div key={icon.name} className={style.iconInputGroup}>
                    <img
                        alt=""
                        className={style.iconPreview}
                        src={icon.content}
                    />
                    <div className={style.iconInput}>
                        <input
                            type={'file'}
                            accept={'.jpg,.png,.gif'}
                            onChange={(e) =>
                                onFileChange({
                                    type: 'icon',
                                    file: e.target.files?.[0],
                                    idx,
                                })
                            }
                        />
                        <div
                            className={
                                'flex-container flex-center flex-no-wrap'
                            }
                            style={{ wordBreak: 'keep-all' }}
                        >
                            <input
                                placeholder={'或者输入https外链'}
                                value={customTheme.icons[idx].content}
                                onBlur={(e) => {
                                    setIconErrors(
                                        makeIconErrors(
                                            idx,
                                            linkReg.test(e.target.value)
                                                ? ''
                                                : '请输入https外链'
                                        )
                                    );
                                }}
                                onChange={(e) =>
                                    updateIcons('content', e.target.value, idx)
                                }
                            />
                            {iconErrors[idx] && (
                                <div className={style.errorTip}>
                                    {iconErrors[idx]}
                                </div>
                            )}
                        </div>
                        <div className={'flex-container'}>
                            <select
                                className={'flex-grow'}
                                value={customTheme.icons[idx].clickSound}
                                onChange={(e) =>
                                    updateIcons(
                                        'clickSound',
                                        e.target.value,
                                        idx
                                    )
                                }
                            >
                                <option value="">默认点击音效</option>
                                {customTheme.sounds.map((sound) => (
                                    <option key={sound.name} value={sound.name}>
                                        {sound.name}
                                    </option>
                                ))}
                            </select>
                            <select
                                className={'flex-grow'}
                                value={customTheme.icons[idx].tripleSound}
                                onChange={(e) =>
                                    updateIcons(
                                        'tripleSound',
                                        e.target.value,
                                        idx
                                    )
                                }
                            >
                                <option value="">默认三连音效</option>
                                {customTheme.sounds.map((sound) => (
                                    <option key={sound.name} value={sound.name}>
                                        {sound.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            ))}
            {/*<InputContainer label={'操作音效'}>？？</InputContainer>*/}

            {genLink && (
                <div className={'flex-container flex-center flex-column'}>
                    <QRCodeCanvas
                        id="qrCode"
                        value={genLink}
                        size={300}
                        className={classNames(
                            style.qrCode,
                            uploading && style.uploading
                        )}
                    />
                    <button
                        onClick={() =>
                            captureElement(
                                'qrCode',
                                `${customTheme.title}-${localStorage.getItem(
                                    LAST_CUSTOM_THEME_ID_STORAGE_KEY
                                )}`
                            )
                        }
                        className="primary"
                    >
                        下载二维码
                    </button>
                    <div style={{ fontSize: 12 }}>{genLink}</div>
                    <button onClick={() => copy(genLink)} className="primary">
                        复制链接
                    </button>
                </div>
            )}
            <div className={style.tip}>
                接口上传内容总体积有限制，上传文件失败请尝试进一步压缩文件，推荐使用外链（自行搜索【免费图床】【免费mp3外链】【对象存储服务】等关键词）。
                本地整活，勾选右侧关闭文件大小校验👉
                <input
                    type={'checkbox'}
                    checked={!enableFileSizeValidate}
                    onChange={(e) =>
                        setEnableFileSizeValidate(!e.target.checked)
                    }
                />
                (谨慎操作，单文件不超过1M为宜，文件过大可能导致崩溃，介时请刷新浏览器)
            </div>
            {configError && <div className={style.errorTip}>{configError}</div>}
            {customTheme.pure && (
                <div className={style.tip}>
                    🎉🎉🎉恭喜发现彩蛋，生成的主题将开启纯净模式～
                </div>
            )}
            <WxQrCode onClick={() => setPureClickTime(pureClickTime + 1)} />
            <div className={'flex-container'}>
                <button
                    className={'primary flex-grow'}
                    onClick={onPreviewClick}
                >
                    保存并预览
                </button>
                {/*<button*/}
                {/*    className={classNames(*/}
                {/*        'primary flex-grow',*/}
                {/*        style.uploadBtn,*/}
                {/*        uploading && style.uploading*/}
                {/*    )}*/}
                {/*    onClick={onGenQrLinkClick}*/}
                {/*    disabled*/}
                {/*>*/}
                {/*    生成二维码&链接*/}
                {/*</button>*/}
            </div>
        </div>
    );
};

export default ConfigDialog;
