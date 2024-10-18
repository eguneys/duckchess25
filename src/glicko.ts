import { Glicko2, Player } from 'glicko2.ts'

export type Glicko_Rating = {
    rating: number,
    deviation: number,
    volatility: number
}
export type RatingDiffs = [number, number]

export function provisional(rating: Glicko_Rating): boolean {
    return rating.deviation >= provisionalDeviation
}

const maxDeviation = 500
const defaultVolatility = 0.09
const provisionalDeviation = 110

export const default_Glicko_Rating = () => ({ rating: 1500, deviation: maxDeviation, volatility: defaultVolatility })

export const display_Glicko = (rating: Glicko_Rating) => `${Math.floor(rating.rating)}${provisional(rating) ? '?' : ''}`

export const ratingOf = (rating: Glicko_Rating) => {
    return Math.floor(rating.rating)
}

export const glicko2_GameResult = (winner: Glicko_Rating, loser: Glicko_Rating, isDraw: boolean): [Glicko_Rating, Glicko_Rating] => {
    let rating = new Glicko2()
    let a = rating.makePlayer(winner.rating, winner.deviation, winner.volatility)
    let b = rating.makePlayer(loser.rating, loser.deviation, loser.volatility)
    rating.addResult(a, b, isDraw ? 0 : 1)

    rating.calculatePlayersRatings()

    const mkRating = (a: Player) => ({
        rating: a.getRating(),
        deviation: a.getRd(),
        volatility: a.getVol()
    })

    console.log('winner', winner.rating, mkRating(a), isDraw)
    console.log('loser', loser.rating, mkRating(b), isDraw)

    return [mkRating(a), mkRating(b)]
}