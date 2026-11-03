// /src/ui/MinimalSettingUI.ts

import gsap from 'gsap';
import {
  CITIES,
  CityPreset,
  DEFAULT_STUDENTS,
  LANTERN_COUNT,
  STORAGE_KEYS,
  WeatherSnapshot,
  cloneDefaultStudents,
} from '../types/SkyLanternTypes';

export interface UICallbacks {
  onStart: () => void;
  onReplay: () => void;
  onCityChange: (cityId: string) => void;
  onRefreshWeather: () => void;
  onSoundToggle: (muted: boolean) => void;
  onStudentsChange: (names: string[]) => void;
  onChosenChange: (index: number) => void;
  onAvoidRepeatChange: (avoid: boolean) => void;
}

const PANEL_STYLE = `
:root {
  --ui-ink: #eaf0f8;
  --ui-muted: rgba(214, 226, 242, 0.56);
  --ui-gold: #e9c891;
  --ui-gold-bright: #ffe1ac;
  --ui-line: rgba(214, 229, 247, 0.14);
  --ui-glass: rgba(8, 14, 22, 0.66);
}
#sl-ui { position: fixed; inset: 0; pointer-events: none; z-index: 20; color: var(--ui-ink); font-family: 'Plus Jakarta Sans', sans-serif; }
#sl-ui * { box-sizing: border-box; }
.ui-vignette { position: fixed; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 46%, transparent 38%, rgba(2, 5, 10, 0.42) 100%); }
.ui-bar { position: fixed; left: 0; right: 0; height: 13vh; pointer-events: none; }
.ui-bar.top { top: 0; height: 31vh; background: linear-gradient(to bottom, rgba(1, 4, 9, 0.82) 0%, rgba(1, 4, 9, 0.48) 45%, transparent 100%); }
.ui-bar.bottom { bottom: 0; height: 20vh; background: linear-gradient(to top, rgba(1, 4, 9, 0.8), transparent); }

.ui-flash { position: fixed; inset: 0; opacity: 0; pointer-events: none; mix-blend-mode: screen; }
.ui-blackout { position: fixed; inset: 0; opacity: 0; pointer-events: none; background: #02050a; z-index: 40; }
#sl-flash-gold { background: radial-gradient(circle at 50% 42%, #fffdf2 0%, #ffeec2 22%, rgba(255, 205, 130, 0.85) 45%, rgba(255, 176, 92, 0.25) 72%, transparent 100%); }
#sl-flash-blue { background: radial-gradient(ellipse at 55% 30%, rgba(220, 235, 255, 0.95) 0%, rgba(160, 195, 255, 0.45) 38%, transparent 72%); }

.gear-btn { position: fixed; top: 26px; right: 30px; width: 46px; height: 46px; border-radius: 50%; border: 1px solid var(--ui-line);
  background: rgba(6, 11, 18, 0.68); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto; color: rgba(232, 240, 250, 0.78);
  transition: color .35s ease, border-color .35s ease, transform .5s cubic-bezier(.2,.8,.2,1), background .35s; }
.gear-btn:hover { color: var(--ui-gold-bright); border-color: rgba(233, 200, 145, 0.55); transform: rotate(38deg); background: rgba(12, 20, 30, 0.6); }
.gear-btn svg { width: 20px; height: 20px; }

.title-block { position: fixed; top: 11.5vh; left: 0; right: 0; text-align: center; pointer-events: none; }
.title-kicker { font-size: 9.5px; letter-spacing: .42em; text-transform: uppercase; color: rgba(224, 236, 248, 0.6); margin-bottom: 20px; text-shadow: 0 2px 12px rgba(0,0,0,.9); }
.title-main { font-family: 'Cormorant Garamond', 'Noto Serif Display', serif; font-weight: 400; font-size: clamp(34px, 4.4vw, 62px);
  letter-spacing: .12em; line-height: 1.05; color: #f3f7ff; text-shadow: 0 6px 40px rgba(3, 8, 16, 0.8); }
.title-main span { color: var(--ui-gold-bright); }
.title-sub { margin-top: 14px; font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 300; font-size: clamp(14px, 1.5vw, 20px);
  letter-spacing: .16em; color: rgba(231, 239, 250, 0.72); text-shadow: 0 2px 18px rgba(0,0,0,.95); }
.title-meta { margin-top: 22px; display: flex; align-items: center; justify-content: center; gap: 12px; font-size: 9.5px; letter-spacing: .28em;
  text-transform: uppercase; color: rgba(224, 235, 248, 0.62); text-shadow: 0 2px 14px rgba(0,0,0,.95); }
.title-meta .dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(233, 200, 145, 0.65); }

.start-btn { position: fixed; bottom: 7.5vh; left: 50%; transform: translateX(-50%); pointer-events: auto; cursor: pointer;
  background: linear-gradient(180deg, rgba(9, 15, 24, 0.82), rgba(6, 10, 17, 0.74)); border: 1px solid rgba(233, 200, 145, 0.42); box-shadow: 0 18px 50px rgba(0,0,0,.35);
  border-radius: 2px; padding: 16px 52px 14px; color: var(--ui-ink); min-width: 232px; text-align: center;
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); overflow: hidden;
  transition: border-color .45s ease, background .45s ease, box-shadow .45s ease, letter-spacing .5s ease; }
.start-btn:before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 140%, rgba(255, 194, 104, 0.24), transparent 60%); opacity: .6; transition: opacity .5s; }
.start-btn:hover { border-color: rgba(255, 221, 160, 0.74); box-shadow: 0 0 46px rgba(255, 196, 106, 0.16), inset 0 0 26px rgba(255, 201, 120, 0.06); }
.start-btn:hover:before { opacity: 1; }
.start-btn .btn-small { display: block; font-size: 8.5px; letter-spacing: .42em; text-transform: uppercase; color: rgba(233, 200, 145, 0.72); margin-bottom: 7px; }
.start-btn .btn-main { display: block; font-family: 'Cormorant Garamond', serif; font-size: 28px; letter-spacing: .14em; line-height: 1; color: #f7f3ea; }
.start-btn:disabled { opacity: .4; cursor: wait; }

.caption { position: fixed; top: 9vh; left: 0; right: 0; text-align: center; font-size: 10px; letter-spacing: .46em; text-transform: uppercase;
  color: rgba(223, 235, 249, 0.55); opacity: 0; pointer-events: none; }
.caption .cap-line { display: block; width: 34px; height: 1px; background: linear-gradient(90deg, transparent, rgba(233, 200, 145, 0.6), transparent); margin: 12px auto 0; }

.death-card { position: fixed; left: 6.5vw; top: 44%; transform: translateY(-50%); pointer-events: none; opacity: 0;
  padding-left: 18px; border-left: 1px solid rgba(168, 199, 232, 0.34); max-width: 320px; }
.death-card .death-label { font-size: 8.5px; letter-spacing: .38em; text-transform: uppercase; color: rgba(174, 202, 233, 0.6); margin-bottom: 10px; }
.death-card .death-name { font-family: 'Cormorant Garamond', serif; font-size: clamp(22px, 2.6vw, 34px); font-weight: 400; letter-spacing: .04em; color: #eef5ff;
  text-shadow: 0 4px 24px rgba(0,0,0,.6); }
.death-card .death-note { margin-top: 9px; font-size: 9px; letter-spacing: .26em; text-transform: uppercase; color: rgba(230, 238, 249, 0.36); }

.winner-card { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;
  opacity: 0; text-align: center; padding: 20vh 6vw 0; background: radial-gradient(ellipse at 50% 48%, rgba(4, 9, 16, 0.04), rgba(3, 7, 13, 0.28) 80%); }
.winner-card .win-kicker { font-size: 9px; letter-spacing: .5em; text-transform: uppercase; color: rgba(255, 225, 172, 0.8); margin-bottom: 26px; }
.winner-card .win-name { font-family: 'Noto Serif Display', 'Cormorant Garamond', serif; font-size: clamp(42px, 6.4vw, 92px); font-weight: 500;
  letter-spacing: .055em; line-height: 1.08; color: #fffaf0; text-shadow: 0 0 60px rgba(255, 205, 130, 0.4), 0 8px 50px rgba(0, 0, 0, 0.55);
  background: linear-gradient(180deg, #fffdf6 10%, #ffe6b4 60%, #e9bd79 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.winner-card .win-line { width: 150px; height: 1px; margin: 30px auto; background: linear-gradient(90deg, transparent, rgba(255, 219, 156, 0.9), transparent); }
.winner-card .win-sub { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: clamp(14px, 1.6vw, 19px); letter-spacing: .09em;
  color: rgba(245, 238, 224, 0.72); max-width: 620px; line-height: 1.7; }
.winner-card .win-meta { margin-top: 18px; font-size: 8.5px; letter-spacing: .36em; text-transform: uppercase; color: rgba(233, 200, 145, 0.55); }
.win-actions { margin-top: 42px; pointer-events: auto; display: flex; gap: 14px; }
.replay-btn { background: rgba(11, 18, 28, 0.4); border: 1px solid rgba(233, 200, 145, 0.36); color: #f4ecdd; border-radius: 2px;
  padding: 13px 30px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 9px; letter-spacing: .34em; text-transform: uppercase; cursor: pointer;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); transition: background .3s, border-color .3s, color .3s; }
.replay-btn:hover { border-color: rgba(255, 225, 170, 0.8); background: rgba(233, 200, 145, 0.12); color: #fff8ea; }

.panel-backdrop { position: fixed; inset: 0; background: rgba(2, 5, 9, 0.5); backdrop-filter: blur(3px); opacity: 0; pointer-events: none; transition: opacity .5s ease; }
.panel-backdrop.open { opacity: 1; pointer-events: auto; }
.panel { position: fixed; top: 0; right: 0; height: 100%; width: min(432px, 94vw); background: linear-gradient(160deg, rgba(10, 17, 27, 0.9), rgba(6, 11, 18, 0.94));
  border-left: 1px solid rgba(215, 231, 248, 0.12); backdrop-filter: blur(28px) saturate(135%); -webkit-backdrop-filter: blur(28px) saturate(135%);
  display: flex; flex-direction: column; transform: translateX(102%); transition: transform .65s cubic-bezier(.16, 1, .3, 1); pointer-events: auto;
  box-shadow: -40px 0 80px rgba(0, 0, 0, 0.45); }
.panel.open { transform: translateX(0); }
.panel-head { display: flex; align-items: center; justify-content: space-between; padding: 30px 30px 20px; border-bottom: 1px solid var(--ui-line); }
.panel-title { font-family: 'Cormorant Garamond', serif; font-size: 26px; letter-spacing: .1em; color: #f2f6fc; }
.panel-title small { display: block; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 8px; letter-spacing: .4em; color: rgba(214, 226, 242, 0.4); margin-top: 8px; text-transform: uppercase; }
.panel-close { width: 34px; height: 34px; border-radius: 50%; border: 1px solid rgba(214, 228, 247, 0.16); background: transparent; color: rgba(232, 240, 250, 0.7);
  cursor: pointer; font-size: 16px; line-height: 1; display: flex; align-items: center; justify-content: center; transition: border-color .3s, color .3s; }
.panel-close:hover { border-color: rgba(233, 200, 145, 0.6); color: var(--ui-gold-bright); }
.panel-body { overflow-y: auto; padding: 22px 30px 34px; scrollbar-width: thin; scrollbar-color: rgba(233, 200, 145, 0.28) transparent; }
.panel-body::-webkit-scrollbar { width: 5px; }
.panel-body::-webkit-scrollbar-thumb { background: rgba(233, 200, 145, 0.24); border-radius: 4px; }
.section { margin-bottom: 30px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.section-title { font-size: 8.5px; letter-spacing: .34em; text-transform: uppercase; color: rgba(216, 230, 246, 0.55); }
.section-aside { font-size: 8px; letter-spacing: .16em; color: rgba(233, 200, 145, 0.6); text-transform: uppercase; }
.city-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.city-chip { border: 1px solid rgba(214, 228, 247, 0.1); background: rgba(255, 255, 255, 0.018); border-radius: 2px; padding: 10px 11px; cursor: pointer;
  text-align: left; color: rgba(233, 240, 250, 0.72); transition: border-color .3s, background .3s, color .3s; font-family: 'Plus Jakarta Sans', sans-serif; }
.city-chip:hover { border-color: rgba(233, 200, 145, 0.38); color: #f6f9ff; }
.city-chip.active { border-color: rgba(233, 200, 145, 0.62); background: rgba(233, 200, 145, 0.075); color: #fff6e6; }
.city-chip .c-name { display: block; font-size: 11.5px; letter-spacing: .06em; }
.city-chip .c-region { display: block; font-size: 8px; letter-spacing: .18em; text-transform: uppercase; color: rgba(214, 226, 242, 0.36); margin-top: 4px; }
.weather-card { margin-top: 12px; border: 1px solid rgba(214, 228, 247, 0.09); background: linear-gradient(160deg, rgba(255, 255, 255, 0.028), rgba(255, 255, 255, 0.006)); padding: 16px; border-radius: 2px; }
.weather-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.weather-city { font-family: 'Cormorant Garamond', serif; font-size: 20px; letter-spacing: .05em; color: #eef4fc; }
.weather-cond { margin-top: 3px; font-size: 9px; letter-spacing: .2em; text-transform: uppercase; color: rgba(214, 226, 242, 0.4); }
.weather-refresh { border: 1px solid rgba(214, 228, 247, 0.14); background: transparent; color: rgba(226, 237, 250, 0.6); width: 28px; height: 28px;
  border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: border-color .3s, color .3s, transform .6s; }
.weather-refresh:hover { border-color: rgba(233, 200, 145, 0.6); color: var(--ui-gold-bright); transform: rotate(180deg); }
.weather-refresh svg { width: 13px; height: 13px; }
.weather-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; margin-top: 18px; }
.metric .m-label { font-size: 7.5px; letter-spacing: .26em; text-transform: uppercase; color: rgba(214, 226, 242, 0.34); }
.metric .m-value { margin-top: 4px; font-size: 14px; letter-spacing: .04em; color: #e9f1fb; font-variant-numeric: tabular-nums; }
.metric .m-value .unit { font-size: 9px; color: rgba(214, 226, 242, 0.42); margin-left: 3px; letter-spacing: .1em; }
.wind-arrow { display: inline-block; margin-left: 6px; color: var(--ui-gold); transition: transform .8s cubic-bezier(.2,.8,.2,1); }
.weather-source { margin-top: 16px; padding-top: 12px; border-top: 1px dashed rgba(214, 228, 247, 0.1); display: flex; align-items: center; justify-content: space-between;
  font-size: 7.5px; letter-spacing: .22em; text-transform: uppercase; color: rgba(214, 226, 242, 0.32); }
.source-live { display: flex; align-items: center; gap: 6px; color: rgba(178, 226, 194, 0.75); }
.source-live .pulse { width: 5px; height: 5px; border-radius: 50%; background: #8fe0a8; box-shadow: 0 0 8px rgba(143, 224, 168, 0.8); animation: slpulse 2.4s ease-in-out infinite; }
.source-fallback { color: rgba(233, 200, 145, 0.7); }
@keyframes slpulse { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
.weather-poem { margin-top: 12px; font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 13px; letter-spacing: .04em; color: rgba(226, 236, 249, 0.46); }

.select-wrap { position: relative; }
.sl-select { width: 100%; appearance: none; -webkit-appearance: none; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(214, 228, 247, 0.13);
  color: #eef4fc; padding: 12px 34px 12px 13px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 11.5px; letter-spacing: .04em; border-radius: 2px; cursor: pointer; outline: none; }
.sl-select option { background: #0a121c; color: #eef4fc; }
.select-wrap:after { content: ''; position: absolute; right: 14px; top: 50%; width: 6px; height: 6px; border-right: 1px solid rgba(233, 200, 145, 0.7);
  border-bottom: 1px solid rgba(233, 200, 145, 0.7); transform: translateY(-70%) rotate(45deg); pointer-events: none; }
.hint { margin-top: 9px; font-size: 8.5px; letter-spacing: .1em; line-height: 1.6; color: rgba(214, 226, 242, 0.33); }

.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 0; border-bottom: 1px solid rgba(214, 228, 247, 0.07); }
.toggle-row:last-child { border-bottom: none; }
.toggle-copy .t-title { font-size: 11.5px; letter-spacing: .05em; color: rgba(238, 244, 252, 0.88); }
.toggle-copy .t-desc { margin-top: 4px; font-size: 8.5px; letter-spacing: .08em; line-height: 1.55; color: rgba(214, 226, 242, 0.32); }
.sl-switch { flex: 0 0 auto; width: 40px; height: 22px; border-radius: 20px; border: 1px solid rgba(214, 228, 247, 0.18); background: rgba(255, 255, 255, 0.03);
  position: relative; cursor: pointer; transition: background .4s, border-color .4s; }
.sl-switch:after { content: ''; position: absolute; top: 50%; left: 4px; width: 14px; height: 14px; border-radius: 50%; background: rgba(226, 237, 250, 0.55);
  transform: translateY(-50%); transition: left .4s cubic-bezier(.2,.8,.2,1), background .4s, box-shadow .4s; }
.sl-switch.on { background: rgba(233, 200, 145, 0.14); border-color: rgba(233, 200, 145, 0.6); }
.sl-switch.on:after { left: 20px; background: var(--ui-gold-bright); box-shadow: 0 0 12px rgba(255, 219, 156, 0.55); }

.student-list { max-height: 236px; overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 9px 14px; padding-right: 4px; scrollbar-width: thin; scrollbar-color: rgba(233, 200, 145, 0.24) transparent; }
.student-list::-webkit-scrollbar { width: 4px; }
.student-list::-webkit-scrollbar-thumb { background: rgba(233, 200, 145, 0.22); border-radius: 4px; }
.student-item { display: flex; align-items: center; gap: 7px; border-bottom: 1px solid rgba(214, 228, 247, 0.08); padding-bottom: 5px; }
.student-no { font-size: 8px; letter-spacing: .08em; color: rgba(233, 200, 145, 0.55); font-variant-numeric: tabular-nums; }
.student-input { width: 100%; background: transparent; border: none; color: rgba(238, 244, 252, 0.82); font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 10.5px; letter-spacing: .01em; padding: 3px 0; outline: none; }
.student-input:focus { color: #fff8e9; border-bottom-color: rgba(233, 200, 145, 0.5); }
.panel-foot { margin-top: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 7.5px; letter-spacing: .18em; text-transform: uppercase; color: rgba(214, 226, 242, 0.26); }
.reset-btn { background: transparent; border: none; color: rgba(233, 200, 145, 0.55); font-size: 8px; letter-spacing: .2em; text-transform: uppercase; cursor: pointer; padding: 4px 0; }
.reset-btn:hover { color: var(--ui-gold-bright); }

@media (max-width: 720px) {
  .gear-btn { top: 18px; right: 18px; width: 42px; height: 42px; }
  .title-block { top: 11vh; }
  .title-kicker { font-size: 8px; letter-spacing: .34em; margin-bottom: 14px; }
  .title-sub { letter-spacing: .08em; }
  .title-meta { font-size: 8px; letter-spacing: .16em; }
  .start-btn { bottom: 6vh; padding: 14px 40px 12px; min-width: 208px; }
  .death-card { left: 5vw; top: 40%; }
  .student-list { grid-template-columns: 1fr; max-height: 210px; }
  .panel-body { padding: 18px 22px 28px; }
  .panel-head { padding: 24px 22px 16px; }
  .win-actions { margin-top: 30px; }
}
`;

export class MinimalSettingUI {
  private readonly root: HTMLDivElement;
  private readonly titleBlock: HTMLDivElement;
  private readonly startButton: HTMLButtonElement;
  private readonly gearButton: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly captionEl: HTMLDivElement;
  private readonly deathCard: HTMLDivElement;
  private readonly deathName: HTMLDivElement;
  private readonly deathNote: HTMLDivElement;
  private readonly winnerCard: HTMLDivElement;
  private readonly winnerName: HTMLDivElement;
  private readonly winnerMeta: HTMLDivElement;
  private readonly flashGold: HTMLDivElement;
  private readonly flashBlue: HTMLDivElement;
  private readonly blackout: HTMLDivElement;
  private readonly weatherCity: HTMLDivElement;
  private readonly weatherCond: HTMLDivElement;
  private readonly weatherMetrics: HTMLDivElement;
  private readonly weatherSource: HTMLDivElement;
  private readonly weatherPoem: HTMLDivElement;
  private readonly cityGrid: HTMLDivElement;
  private readonly chosenSelect: HTMLSelectElement;
  private readonly avoidSwitch: HTMLButtonElement;
  private readonly soundSwitch: HTMLButtonElement;
  private readonly studentList: HTMLDivElement;
  private readonly metaText: HTMLSpanElement;
  private readonly titleMeta: HTMLDivElement;

  private readonly callbacks: UICallbacks;
  private students: string[];
  private chosenIndex = -1;
  private avoidRepeat = true;
  private soundMuted = false;
  private cityId = 'tokyo';
  private usedWinners: string[] = [];
  private running = false;
  private weatherLoading = false;
  private captionTimeline: gsap.core.Timeline | null = null;
  private deathTimeline: gsap.core.Timeline | null = null;
  private readonly cityChips = new Map<string, HTMLButtonElement>();
  private latestWeather: WeatherSnapshot | null = null;

  constructor(container: HTMLElement, callbacks: UICallbacks) {
    this.callbacks = callbacks;
    this.students = this.loadStudents();
    this.chosenIndex = this.loadNumber(STORAGE_KEYS.chosen, -1);
    this.avoidRepeat = this.loadBool(STORAGE_KEYS.avoidRepeat, true);
    this.soundMuted = this.loadBool(STORAGE_KEYS.sound, false);
    this.cityId = localStorage.getItem(STORAGE_KEYS.city) ?? 'tokyo';
    this.usedWinners = this.loadStringArray(STORAGE_KEYS.usedWinners);

    const style = document.createElement('style');
    style.textContent = PANEL_STYLE;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.id = 'sl-ui';
    this.root.innerHTML = `
      <div class="ui-vignette"></div>
      <div class="ui-bar top"></div>
      <div class="ui-bar bottom"></div>
      <div class="ui-flash" id="sl-flash-gold"></div>
      <div class="ui-flash" id="sl-flash-blue"></div>
      <div class="ui-blackout" id="sl-blackout"></div>
      <button class="gear-btn" aria-label="Cài đặt" title="Cài đặt">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.1">
          <circle cx="12" cy="12" r="3.2"/>
          <path d="M12 2.4v2.7M12 18.9v2.7M2.4 12h2.7M18.9 12h2.7M5.2 5.2l1.9 1.9M16.9 16.9l1.9 1.9M18.8 5.2l-1.9 1.9M7.1 16.9l-1.9 1.9"/>
        </svg>
      </button>
      <div class="title-block">
        <div class="title-kicker">A Cinematic Sky Ritual · 28 Lanterns</div>
        <div class="title-main">Người Gác <span>Đèn Trời</span></div>
        <div class="title-sub">&amp; Cơn Mưa Sao Băng Ngược</div>
        <div class="title-meta"><span id="sl-meta-text">Đang kết nối bầu trời…</span></div>
      </div>
      <button class="start-btn">
        <span class="btn-small">Bắt đầu nghi thức</span>
        <span class="btn-main">Bắt đầu</span>
      </button>
      <div class="caption"><span class="cap-text"></span><span class="cap-line"></span></div>
      <div class="death-card">
        <div class="death-label">Đèn đã tắt</div>
        <div class="death-name"></div>
        <div class="death-note"></div>
      </div>
      <div class="winner-card">
        <div class="win-kicker">Người Gác Đèn Trời</div>
        <div class="win-name"></div>
        <div class="win-line"></div>
        <div class="win-sub">Một ước nguyện đã chạm tới tầng mây cao nhất,<br/>và mang cả bầu trời trở lại trong xanh.</div>
        <div class="win-meta">28 học sinh · 1 ước nguyện</div>
        <div class="win-actions"><button class="replay-btn">Thắp lại bầu trời</button></div>
      </div>
      <div class="panel-backdrop"></div>
      <aside class="panel">
        <div class="panel-head">
          <div class="panel-title">Cài Đặt<small>Sky Lantern Ritual</small></div>
          <button class="panel-close" aria-label="Đóng">✕</button>
        </div>
        <div class="panel-body">
          <div class="section">
            <div class="section-head"><div class="section-title">Bầu trời trực tiếp</div><div class="section-aside">Open-Meteo</div></div>
            <div class="city-grid"></div>
            <div class="weather-card">
              <div class="weather-top">
                <div>
                  <div class="weather-city"></div>
                  <div class="weather-cond"></div>
                </div>
                <button class="weather-refresh" aria-label="Làm mới thời tiết">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M20 11a8 8 0 1 0-2.2 5.8"/><path d="M20 4v7h-7"/></svg>
                </button>
              </div>
              <div class="weather-metrics"></div>
              <div class="weather-source"></div>
              <div class="weather-poem"></div>
            </div>
          </div>
          <div class="section">
            <div class="section-head"><div class="section-title">Đèn định mệnh</div><div class="section-aside">Người được chọn</div></div>
            <div class="select-wrap"><select class="sl-select chosen-select"></select></div>
            <div class="hint">Chiếc đèn này sẽ được giữ lại tới khoảnh khắc cuối cùng, trước khi chạm vào khe sáng.</div>
          </div>
          <div class="section">
            <div class="section-head"><div class="section-title">Nghi thức</div><div class="section-aside">Tùy chọn</div></div>
            <div class="toggle-row">
              <div class="toggle-copy">
                <div class="t-title">Không lặp lại người đã gọi</div>
                <div class="t-desc avoid-desc">Những người từng chạm tới bầu trời sẽ không được chọn lại.</div>
              </div>
              <button class="sl-switch avoid-switch" role="switch" aria-label="Không lặp lại"></button>
            </div>
            <div class="toggle-row">
              <div class="toggle-copy">
                <div class="t-title">Âm thanh điện ảnh</div>
                <div class="t-desc">Mưa, sấm rền, chuông gió furin và đàn hạc — tổng hợp trực tiếp bằng Web Audio.</div>
              </div>
              <button class="sl-switch sound-switch" role="switch" aria-label="Âm thanh"></button>
            </div>
          </div>
          <div class="section">
            <div class="section-head"><div class="section-title">28 học sinh</div><div class="section-aside avoid-count"></div></div>
            <div class="student-list"></div>
          </div>
          <div class="panel-foot">
            <span>Lưu trên thiết bị này</span>
            <button class="reset-btn">Đặt lại danh sách</button>
          </div>
        </div>
      </aside>
    `;
    container.appendChild(this.root);

    this.titleBlock = this.root.querySelector('.title-block') as HTMLDivElement;
    this.titleMeta = this.root.querySelector('.title-meta') as HTMLDivElement;
    this.metaText = this.root.querySelector('#sl-meta-text') as HTMLSpanElement;
    this.startButton = this.root.querySelector('.start-btn') as HTMLButtonElement;
    this.gearButton = this.root.querySelector('.gear-btn') as HTMLButtonElement;
    this.panel = this.root.querySelector('.panel') as HTMLElement;
    this.backdrop = this.root.querySelector('.panel-backdrop') as HTMLElement;
    this.captionEl = this.root.querySelector('.caption') as HTMLDivElement;
    this.deathCard = this.root.querySelector('.death-card') as HTMLDivElement;
    this.deathName = this.root.querySelector('.death-name') as HTMLDivElement;
    this.deathNote = this.root.querySelector('.death-note') as HTMLDivElement;
    this.winnerCard = this.root.querySelector('.winner-card') as HTMLDivElement;
    this.winnerName = this.root.querySelector('.win-name') as HTMLDivElement;
    this.winnerMeta = this.root.querySelector('.win-meta') as HTMLDivElement;
    this.flashGold = this.root.querySelector('#sl-flash-gold') as HTMLDivElement;
    this.flashBlue = this.root.querySelector('#sl-flash-blue') as HTMLDivElement;
    this.blackout = this.root.querySelector('#sl-blackout') as HTMLDivElement;
    this.weatherCity = this.root.querySelector('.weather-city') as HTMLDivElement;
    this.weatherCond = this.root.querySelector('.weather-cond') as HTMLDivElement;
    this.weatherMetrics = this.root.querySelector('.weather-metrics') as HTMLDivElement;
    this.weatherSource = this.root.querySelector('.weather-source') as HTMLDivElement;
    this.weatherPoem = this.root.querySelector('.weather-poem') as HTMLDivElement;
    this.cityGrid = this.root.querySelector('.city-grid') as HTMLDivElement;
    this.chosenSelect = this.root.querySelector('.chosen-select') as HTMLSelectElement;
    this.avoidSwitch = this.root.querySelector('.avoid-switch') as HTMLButtonElement;
    this.soundSwitch = this.root.querySelector('.sound-switch') as HTMLButtonElement;
    this.studentList = this.root.querySelector('.student-list') as HTMLDivElement;

    this.buildCityGrid();
    this.buildChosenSelect();
    this.buildStudentList();
    this.refreshToggles();
    this.bindEvents();
    this.updateMeta();
  }

  private loadStudents(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.students);
      if (!raw) return cloneDefaultStudents();
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return cloneDefaultStudents();
      const names = parsed.map((v) => (typeof v === 'string' ? v : ''));
      for (let i = 0; i < LANTERN_COUNT; i++) {
        if (!names[i] || !names[i].trim()) names[i] = DEFAULT_STUDENTS[i];
      }
      return names.slice(0, LANTERN_COUNT);
    } catch {
      return cloneDefaultStudents();
    }
  }

  private loadStringArray(key: string): string[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }

  private loadNumber(key: string, fallback: number): number {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  private loadBool(key: string, fallback: boolean): boolean {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1' || raw === 'true';
  }

  private buildCityGrid(): void {
    for (const city of CITIES) {
      const chip = document.createElement('button');
      chip.className = 'city-chip';
      chip.dataset.city = city.id;
      const name = document.createElement('span');
      name.className = 'c-name';
      name.textContent = city.name;
      const region = document.createElement('span');
      region.className = 'c-region';
      region.textContent = city.region;
      chip.append(name, region);
      chip.addEventListener('click', () => {
        if (this.cityId === city.id) return;
        this.cityId = city.id;
        localStorage.setItem(STORAGE_KEYS.city, city.id);
        this.syncActiveCity();
        this.callbacks.onCityChange(city.id);
      });
      this.cityGrid.appendChild(chip);
      this.cityChips.set(city.id, chip);
    }
    this.syncActiveCity();
  }

  private syncActiveCity(): void {
    for (const [id, chip] of this.cityChips) {
      chip.classList.toggle('active', id === this.cityId);
    }
  }

  private buildChosenSelect(): void {
    this.chosenSelect.innerHTML = '';
    const randomOption = document.createElement('option');
    randomOption.value = '-1';
    randomOption.textContent = 'Ngẫu nhiên — để bầu trời chọn';
    this.chosenSelect.appendChild(randomOption);
    for (let i = 0; i < LANTERN_COUNT; i++) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = `${String(i + 1).padStart(2, '0')} · ${this.students[i]}`;
      this.chosenSelect.appendChild(option);
    }
    if (this.chosenIndex < 0 || this.chosenIndex >= LANTERN_COUNT) this.chosenIndex = -1;
    this.chosenSelect.value = String(this.chosenIndex);
  }

  private buildStudentList(): void {
    this.studentList.innerHTML = '';
    for (let i = 0; i < LANTERN_COUNT; i++) {
      const item = document.createElement('div');
      item.className = 'student-item';
      const no = document.createElement('span');
      no.className = 'student-no';
      no.textContent = String(i + 1).padStart(2, '0');
      const input = document.createElement('input');
      input.className = 'student-input';
      input.value = this.students[i];
      input.maxLength = 28;
      input.setAttribute('aria-label', `Học sinh ${i + 1}`);
      input.addEventListener('change', () => {
        const value = input.value.trim();
        this.students[i] = value || DEFAULT_STUDENTS[i];
        input.value = this.students[i];
        this.persistStudents();
        this.refreshChosenOptions();
        this.callbacks.onStudentsChange([...this.students]);
      });
      item.append(no, input);
      this.studentList.appendChild(item);
    }
    this.refreshAvoidInfo();
  }

  private refreshChosenOptions(): void {
    const current = this.chosenIndex;
    const options = this.chosenSelect.querySelectorAll('option');
    options.forEach((opt) => {
      const idx = Number(opt.value);
      if (idx >= 0) opt.textContent = `${String(idx + 1).padStart(2, '0')} · ${this.students[idx]}`;
    });
    this.chosenSelect.value = String(current);
  }

  private persistStudents(): void {
    localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(this.students));
  }

  private refreshToggles(): void {
    this.avoidSwitch.classList.toggle('on', this.avoidRepeat);
    this.avoidSwitch.setAttribute('aria-checked', String(this.avoidRepeat));
    this.soundSwitch.classList.toggle('on', !this.soundMuted);
    this.soundSwitch.setAttribute('aria-checked', String(!this.soundMuted));
  }

  private refreshAvoidInfo(): void {
    const count = this.root.querySelector('.avoid-count');
    if (count) {
      count.textContent = this.usedWinners.length > 0 ? `${this.usedWinners.length} đã gọi` : '28 đang chờ';
    }
    const desc = this.root.querySelector('.avoid-desc');
    if (desc) {
      desc.textContent = this.avoidRepeat
        ? 'Những người từng chạm tới bầu trời sẽ không được chọn lại.'
        : 'Mọi học sinh đều có thể được chọn lại trong nghi thức mới.';
    }
  }

  private bindEvents(): void {
    this.startButton.addEventListener('click', () => {
      if (this.running) return;
      this.callbacks.onStart();
    });

    this.gearButton.addEventListener('click', () => this.openPanel());
    this.backdrop.addEventListener('click', () => this.closePanel());
    (this.root.querySelector('.panel-close') as HTMLButtonElement).addEventListener('click', () => this.closePanel());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closePanel();
    });

    (this.root.querySelector('.weather-refresh') as HTMLButtonElement).addEventListener('click', () => {
      this.callbacks.onRefreshWeather();
    });

    this.chosenSelect.addEventListener('change', () => {
      this.chosenIndex = Number(this.chosenSelect.value);
      localStorage.setItem(STORAGE_KEYS.chosen, String(this.chosenIndex));
      this.callbacks.onChosenChange(this.chosenIndex);
    });

    this.avoidSwitch.addEventListener('click', () => {
      this.avoidRepeat = !this.avoidRepeat;
      localStorage.setItem(STORAGE_KEYS.avoidRepeat, this.avoidRepeat ? '1' : '0');
      this.refreshToggles();
      this.refreshAvoidInfo();
      this.callbacks.onAvoidRepeatChange(this.avoidRepeat);
    });

    this.soundSwitch.addEventListener('click', () => {
      this.soundMuted = !this.soundMuted;
      localStorage.setItem(STORAGE_KEYS.sound, this.soundMuted ? '1' : '0');
      this.refreshToggles();
      this.callbacks.onSoundToggle(this.soundMuted);
    });

    (this.root.querySelector('.replay-btn') as HTMLButtonElement).addEventListener('click', () => {
      this.callbacks.onReplay();
    });

    (this.root.querySelector('.reset-btn') as HTMLButtonElement).addEventListener('click', () => {
      this.students = cloneDefaultStudents();
      this.persistStudents();
      this.buildStudentList();
      this.refreshChosenOptions();
      this.callbacks.onStudentsChange([...this.students]);
    });
  }

  openPanel(): void {
    this.panel.classList.add('open');
    this.backdrop.classList.add('open');
  }

  closePanel(): void {
    this.panel.classList.remove('open');
    this.backdrop.classList.remove('open');
  }

  setRunning(running: boolean): void {
    this.running = running;
    this.startButton.disabled = running;
    if (running) {
      this.startButton.style.pointerEvents = 'none';
      gsap.to([this.titleBlock, this.startButton], {
        opacity: 0,
        y: -10,
        duration: 1.1,
        ease: 'power2.inOut',
        onComplete: () => {
          this.titleBlock.style.display = 'none';
        },
      });
    } else {
      this.startButton.style.pointerEvents = 'auto';
      this.startButton.disabled = false;
      this.titleBlock.style.display = 'block';
      gsap.to([this.titleBlock, this.startButton], { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' });
    }
  }

  setWeatherLoading(): void {
    this.weatherLoading = true;
    this.weatherCond.textContent = 'Đang đọc bầu trời…';
    this.weatherSource.innerHTML = '<span>Open-Meteo</span><span class="source-fallback">Đang kết nối…</span>';
  }

  setWeather(weather: WeatherSnapshot, city: CityPreset): void {
    this.weatherLoading = false;
    this.latestWeather = weather;
    this.weatherCity.textContent = `${city.name} · ${city.region}`;
    this.weatherCond.textContent = weather.condition;
    const windDeg = weather.windDirection;
    const metrics: { label: string; value: string; unit: string; arrow?: number }[] = [
      { label: 'Nhiệt độ', value: weather.temperature.toFixed(0), unit: '°C' },
      { label: 'Mây che', value: weather.cloudCover.toFixed(0), unit: '%' },
      { label: 'Mưa', value: weather.precipitation.toFixed(1), unit: 'mm' },
      { label: 'Gió', value: weather.windSpeed.toFixed(0), unit: 'km/h', arrow: windDeg },
    ];
    this.weatherMetrics.innerHTML = '';
    for (const m of metrics) {
      const div = document.createElement('div');
      div.className = 'metric';
      const label = document.createElement('div');
      label.className = 'm-label';
      label.textContent = m.label;
      const value = document.createElement('div');
      value.className = 'm-value';
      value.textContent = m.value;
      const unit = document.createElement('span');
      unit.className = 'unit';
      unit.textContent = m.unit;
      value.appendChild(unit);
      if (m.arrow !== undefined) {
        const arrow = document.createElement('span');
        arrow.className = 'wind-arrow';
        arrow.textContent = '➤';
        arrow.style.transform = `rotate(${m.arrow + 90}deg)`;
        value.appendChild(arrow);
      }
      div.append(label, value);
      this.weatherMetrics.appendChild(div);
    }
    if (weather.source === 'live') {
      const updated = new Date(weather.fetchedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      this.weatherSource.innerHTML = '';
      const live = document.createElement('span');
      live.className = 'source-live';
      live.innerHTML = '<span class="pulse"></span> Live · Open-Meteo';
      const time = document.createElement('span');
      time.textContent = `Cập nhật ${updated}`;
      this.weatherSource.append(live, time);
    } else {
      this.weatherSource.innerHTML = '';
      const fallback = document.createElement('span');
      fallback.className = 'source-fallback';
      fallback.textContent = 'Dữ liệu dự phòng';
      const note = document.createElement('span');
      note.textContent = 'Không có kết nối';
      this.weatherSource.append(fallback, note);
    }
    this.weatherPoem.textContent = `“${city.poetLine}”`;
    this.updateMeta(weather, city);
  }

  private updateMeta(weather?: WeatherSnapshot, city?: CityPreset): void {
    if (weather && city) {
      this.metaText.textContent = `${city.name} · ${weather.temperature.toFixed(0)}°C · ${weather.condition} · Gió ${weather.windSpeed.toFixed(0)} km/h`;
    } else if (!this.latestWeather) {
      this.metaText.textContent = 'Đang kết nối bầu trời…';
    }
    this.titleMeta.style.opacity = '1';
  }

  showDeath(name: string, remaining: number): void {
    this.deathName.textContent = name;
    this.deathNote.textContent = remaining > 0 ? `${remaining} chiếc đèn còn lại` : '';
    this.deathTimeline?.kill();
    this.deathTimeline = gsap.timeline();
    this.deathTimeline
      .fromTo(this.deathCard, { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' })
      .to(this.deathCard, { opacity: 0, x: -8, duration: 0.9, delay: 1.15, ease: 'power1.in' });
  }

  showWinner(name: string, index: number): void {
    this.winnerName.textContent = name;
    this.winnerMeta.textContent = `Đèn số ${String(index + 1).padStart(2, '0')} / 28 · Người Gác Đèn Trời`;
    gsap.killTweensOf(this.winnerCard);
    this.winnerCard.style.display = 'flex';
    const timeline = gsap.timeline();
    timeline
      .fromTo(this.winnerCard, { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.out' })
      .fromTo(this.winnerName, { opacity: 0, y: 26, letterSpacing: '0.22em' }, {
        opacity: 1,
        y: 0,
        letterSpacing: '0.055em',
        duration: 2.1,
        ease: 'power3.out',
      }, 0.3)
      .fromTo('.win-kicker', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.2 }, 0.1)
      .fromTo('.win-line', { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 1.6 }, 1.0)
      .fromTo('.win-sub, .win-meta, .win-actions', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.18 }, 1.2);
  }

  hideWinner(): void {
    gsap.killTweensOf(this.winnerCard);
    gsap.to(this.winnerCard, {
      opacity: 0,
      duration: 0.5,
      onComplete: () => {
        this.winnerCard.style.display = 'none';
      },
    });
  }

  showCaption(text: string, duration = 3.2): void {
    const el = this.captionEl.querySelector('.cap-text') as HTMLSpanElement;
    el.textContent = text;
    this.captionTimeline?.kill();
    this.captionTimeline = gsap.timeline();
    this.captionTimeline
      .fromTo(this.captionEl, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' })
      .to(this.captionEl, { opacity: 0, y: -4, duration: 1.3, delay: duration, ease: 'power2.in' });
  }

  flashLightning(strength = 1): void {
    gsap.killTweensOf(this.flashBlue);
    this.flashBlue.style.opacity = String(Math.min(0.85, 0.28 + strength * 0.5));
    gsap.to(this.flashBlue, { opacity: 0, duration: 0.42, ease: 'power2.out' });
  }

  flashGolden(): void {
    gsap.killTweensOf(this.flashGold);
    gsap.timeline()
      .set(this.flashGold, { opacity: 1 })
      .to(this.flashGold, { opacity: 0, duration: 2.6, ease: 'power2.out', delay: 0.35 });
  }

  fadeBlack(onMid: () => void): void {
    gsap.killTweensOf(this.blackout);
    this.blackout.style.pointerEvents = 'auto';
    gsap.timeline()
      .to(this.blackout, { opacity: 1, duration: 0.85, ease: 'power2.inOut', onComplete: onMid })
      .to(this.blackout, { opacity: 0, duration: 1.5, delay: 0.2, ease: 'power2.out' })
      .set(this.blackout, { pointerEvents: 'none' });
  }

  recordWinner(name: string): void {
    if (!this.usedWinners.includes(name)) this.usedWinners.push(name);
    localStorage.setItem(STORAGE_KEYS.usedWinners, JSON.stringify(this.usedWinners));
    this.refreshAvoidInfo();
  }

  getCityId(): string {
    return this.cityId;
  }

  getStudents(): string[] {
    return [...this.students];
  }

  getChosenIndex(): number {
    return this.chosenIndex;
  }

  getAvoidRepeat(): boolean {
    return this.avoidRepeat;
  }

  getUsedWinners(): string[] {
    return [...this.usedWinners];
  }

  isMuted(): boolean {
    return this.soundMuted;
  }

  setMuted(muted: boolean): void {
    this.soundMuted = muted;
    localStorage.setItem(STORAGE_KEYS.sound, muted ? '1' : '0');
    this.refreshToggles();
  }

  setStartEnabled(enabled: boolean): void {
    this.startButton.disabled = !enabled;
    this.startButton.style.opacity = enabled ? '1' : '0.5';
  }

  notifyStartBlocked(message: string): void {
    gsap.fromTo(this.startButton, { x: -6 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.35)' });
    this.startButton.querySelector('.btn-small')!.textContent = message;
    window.setTimeout(() => {
      const el = this.startButton.querySelector('.btn-small');
      if (el) el.textContent = 'Bắt đầu nghi thức';
    }, 2600);
  }
}
