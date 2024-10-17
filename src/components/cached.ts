import { cache } from '@solidjs/router'
import * as s from '~/session'

export const getUser = cache(s.getUser, "get_user")
export const resetUser = cache(s.resetUser, "reset_user")
export const getUserJsonView = cache(s.getUserJsonViewByUsername, "get_user_json")
export const getLeaderboard = cache(s.getLeaderboard, 'leaderboard')