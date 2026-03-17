import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CoreModule } from './core/core.module';
import { SocialMediaModule } from './social-media/social-media.module';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CoreModule,SocialMediaModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'SuiviArgent';

}