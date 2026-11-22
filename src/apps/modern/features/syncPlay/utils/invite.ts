/** Query parameter of the invitation link: opening it joins the group. */
export const INVITE_PARAM = 'syncPlayGroup';

export const getSyncPlayInviteLink = (groupId: string) =>
    `${window.location.origin}${window.location.pathname}#/home?${INVITE_PARAM}=${encodeURIComponent(groupId)}`;
