import { Component, Input } from '@angular/core';
@Component({selector:'pg-icon',standalone:false,template:`<svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="paths[name] || paths['box']" /></svg>`})
export class IconComponent {
  @Input() name='box'; @Input() size=20;
  readonly paths:Record<string,string>={
    search:'M21 21l-5-5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
    cart:'M2 3h2l3 13h12l3-9H5M9 21h.01M18 21h.01',
    arrow:'M5 12h14m-5-5 5 5-5 5',
    user:'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    document:'M14 2H5v20h14V7l-5-5v5h5M8 12h8M8 16h6',
    shield:'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4zM8 12l3 3 5-6',
    refresh:'M20 8V3l-3 3a8 8 0 1 0 3 10M20 8h-5',
    plus:'M12 5v14M5 12h14',minus:'M5 12h14',
    trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    check:'M5 12l4 4L19 6', close:'M6 6l12 12M18 6 6 18',
    download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
    box:'M3 7l9-5 9 5v10l-9 5-9-5V7zm0 0 9 5 9-5M12 12v10M7 4.8l10 5.4',
    activity:'M2 12h5l3-8 4 16 3-8h5',
    sliders:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 10h6M9 8h6M17 16h6',
    game:'M8 8h8c4 0 6 10 3 11-2 1-4-3-4-3H9s-2 4-4 3C2 18 4 8 8 8zM7 11v4M5 13h4M16 12h.01M18 14h.01',
    logout:'M9 3H3v18h6M10 12h11m-4-4 4 4-4 4',
    clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    link:'M10 13a5 5 0 0 0 7 0l4-4a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-4 4a5 5 0 0 0 7 7l2-2'
  };
}
