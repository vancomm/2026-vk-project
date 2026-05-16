/// <reference types="vite/client" />

// Декларация для импорта шейдеров в виде строк
declare module '*?raw' {
    const content: string;
    //   default content;
}

declare module '*.glsl' {
    const content: string;
    //   default content;
}