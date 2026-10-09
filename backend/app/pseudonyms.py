import secrets

FIRST_WORDS = (
    'Moon', 'Silver', 'Lunar', 'Mystic', 'Star', 'Aurora', 'Dream', 'Velvet',
    'Secret', 'Crystal', 'Twilight', 'Golden', 'Gentle', 'Quiet', 'Misty', 'Wild',
    'Amber', 'Opal', 'Winter', 'Summer', 'Cosmic', 'Dawn', 'Ivory', 'Willow',
)
SECOND_WORDS = (
    'Willow', 'Fox', 'Bloom', 'Sage', 'Raven', 'Fern', 'Comet', 'Thyme',
    'Owl', 'Rose', 'Maple', 'Cloud', 'Lily', 'Clover', 'Iris', 'Wren',
    'Moss', 'Cedar', 'Orchid', 'Finch', 'Petal', 'Meadow', 'Birch', 'Lotus',
)
RESERVED_PSEUDONYMS = {'Lunar Thyme'}
PSEUDONYMS = tuple(
    f'{first} {second}' for first in FIRST_WORDS for second in SECOND_WORDS
    if f'{first} {second}' not in RESERVED_PSEUDONYMS
)


def choose_pseudonym(unavailable: set[str]) -> str | None:
    available = [name for name in PSEUDONYMS if name not in unavailable]
    return secrets.choice(available) if available else None
