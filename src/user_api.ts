import { ByColor } from "duckops"
import { get_perfs_by_user_id, make_game_rating_diffs, Perfs, update_user_perfs, user_by_id, UserPerfs } from "./db"
import { glicko2_GameResult, Glicko_Rating, RatingDiffs } from "./glicko"
import { Game, GameId, PerfKey, Player, TimeControl, UserId, UserWithPerfs } from "./types"

export const game_repo_set_rating_diffs = async (id: GameId, diffs: RatingDiffs) => {
    await make_game_rating_diffs(id, diffs)
}



export const user_api_update_perfs = async (ups: ByColor<[UserPerfs, UserPerfs]>, perf_key: PerfKey) => {
    await update_user_perfs(...ups.white)
    await update_user_perfs(...ups.black)
}

const game_winner = (game: Game) => {
    if (game.players.white.is_winner) {
        return "white"
    } else if (game.players.black.is_winner) {
        return "black"
    }
}

export const updateRating = (white: Glicko_Rating, black: Glicko_Rating, game: Game): [Glicko_Rating, Glicko_Rating] => {

    switch (game_winner(game)) {
        case undefined: return glicko2_GameResult(white, black, true)
        case "white": return glicko2_GameResult(white, black, false)
        case "black": return glicko2_GameResult(black, white, false)
    }
    throw ""
}


export const user_api_user_with_perfs = async (user_id: UserId): Promise<UserWithPerfs | undefined> => {
    let user = await user_by_id(user_id)
    let perfs = await get_perfs_by_user_id(user_id)

    if (!user || !perfs) {
        return undefined
    }

    return {
        user, perfs
    }
}

export const user_api_pair_with_perfs = async ([white, black]: [UserId, UserId]): Promise<[UserWithPerfs, UserWithPerfs] | undefined> => {
    let w = await user_api_user_with_perfs(white)
    let b = await user_api_user_with_perfs(black)
    console.log(w, b, white, black)

    if (!w || !b)  {
        return undefined
    }

    return [w, b]
}
