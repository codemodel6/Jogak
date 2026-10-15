-- 게시판 예시 글(20261014_board.sql 에서 넣은 6개)과 그 댓글을 지운다. 이제 실제로 쓴 글만 보인다.
-- '후기' 분류에는 만남 후기(reviews 테이블)가 그대로 보인다.
delete from public.board_comments where post_id in (13, 14, 19, 20, 21, 22);
delete from public.board_posts where id in (13, 14, 19, 20, 21, 22);
