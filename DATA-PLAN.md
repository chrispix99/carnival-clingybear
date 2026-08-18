# Data Plan

## Tested sources
### Carnival Cruise Search API (api)
**Used by**: fetchCruises, refreshCruises
**Test command**: `curl -s 'https://www.carnival.com/cruisesearch/api/search?pageNumber=1&numadults=2&ratecodes=FSA&pagesize=8&sort=fromprice&showBest=true&tierCode=01&tgo=FSA,05172026,08172027;OOA,07162026,04302028;P2A,04012026,02282027;PKA,04012026,02282027;PRQ,05012026,09302027;PYJ,05152026,08152027;QOA,05012026,07312028&pastGuest=true&async=true&currency=USD&locality=1'`
**Sample output**: Returns JSON with `results.itineraries[]` containing `shipName`, `shipCode`, `dur`, `departurePortName`, `itineraryTitle`, `portsToDisplay[]`, `sailings[]`. Each sailing has `departureDate`, `arrivalDate`, `sailingId`, `sailingURL`, `rooms` object with `interior`/`balcony`/`suite`/`oceanview` each containing `price`, `soldOut`, `rateCode`, `metacode`.
**Processing**: Flatten itineraries + sailings into individual cruise records. Parse prices as numbers. Store soldOut boolean. Calculate balcony upgrade cost (balcony_price - interior_price). Filter by balcony availability when requested.

## Rejected approaches
- **Tried**: Parsing XML — API returns JSON, not XML
- **Tried**: Using without tgo parameter — returns zero results; requires tgo with rate code date ranges

No remote content images used — utility dashboard with text/icons only.
