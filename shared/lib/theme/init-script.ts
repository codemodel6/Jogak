export const THEME_STORAGE_KEY = "theme";

// 첫 화면이 그려지기 전에 실행해 깜빡임 없이 모드를 정한다 (app/layout.tsx <head>)
// 저장된 선택이 있으면 그걸, 없으면 기기 설정을 따른다
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";var c=document.documentElement.classList;c.remove("light","dark");c.add(t)}catch(e){document.documentElement.classList.add("dark")}})()`;
