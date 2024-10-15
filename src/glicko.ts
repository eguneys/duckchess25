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
    return [winner, loser]
}


