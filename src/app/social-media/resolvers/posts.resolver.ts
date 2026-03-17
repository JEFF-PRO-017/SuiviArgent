import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, MaybeAsync, RedirectCommand, Resolve, RouterStateSnapshot } from "@angular/router";
import { Post } from "../models/post.model";
import { PostsService } from "../services/posts.service";

@Injectable()
export class PostsResolver implements Resolve<Post[]> {

    constructor(private postsService: PostsService) { }

    resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): MaybeAsync<Post[]> {
        return this.postsService.getPosts()
    }

}