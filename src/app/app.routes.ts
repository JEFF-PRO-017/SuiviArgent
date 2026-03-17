import { Routes } from '@angular/router';
import { TestShceetComponent } from './components/test-shceet/test-shceet.component';
// import { TransactionFormComponent } from './components/transacion-form/transacion-form.component';
// import { SocialMediaRoutingModule } from './social-media/social-media-routing.module';
import { PostListComponent } from './social-media/components/post-list/post-list.component';

export const routes: Routes = [
    // { path: '', component: TransactionFormComponent },
    { path: 'test', component: TestShceetComponent },
    // { path: 'social-media', loadChildren: () => import('./social-media/social-media.module').then(m => m.SocialMediaModule) },
    { path: 'social-media', component: PostListComponent },

    { path: '**', redirectTo: 'social-media' }

];
