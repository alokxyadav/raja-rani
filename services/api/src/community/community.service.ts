import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCommentDto, CreatePostDto } from './dto/community.dto';

const MAX_POST_LENGTH = 5000;
const MAX_COMMENT_LENGTH = 2000;

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  async createPost(userId: string, dto: CreatePostDto, isAnnouncement = false) {
    const body = dto.body.trim().slice(0, MAX_POST_LENGTH);
    return this.prisma.communityPost.create({
      data: { userId, body, imageUrl: dto.imageUrl, isAnnouncement },
    });
  }

  async listFeed(page = 1, pageSize = 20) {
    const where = { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.communityPost.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: Math.min(pageSize, 50),
        orderBy: [{ isAnnouncement: 'desc' }, { createdAt: 'desc' }],
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, role: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.communityPost.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async addComment(userId: string, postId: string, dto: CreateCommentDto) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('post not found');

    const body = dto.body.trim().slice(0, MAX_COMMENT_LENGTH);
    return this.prisma.communityComment.create({ data: { postId, userId, body } });
  }

  async listComments(postId: string) {
    return this.prisma.communityComment.findMany({
      where: { postId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  // Moderation happens here, server-side, per the brief — a client can only
  // delete their own post; ADMIN/MODERATOR can delete any post. The role
  // check itself is enforced by the caller (controller's @Roles guard for
  // the admin route); this method additionally enforces ownership for the
  // "delete own post" path so a student can never pass someone else's ID.
  async deleteOwnPost(userId: string, postId: string) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('post not found');
    if (post.userId !== userId) throw new ForbiddenException('not your post');
    return this.prisma.communityPost.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  }

  async moderateDeletePost(postId: string) {
    const post = await this.prisma.communityPost.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException('post not found');
    return this.prisma.communityPost.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  }
}
