# Property wind geography

Miles to coast is a straight-line distance to the nearest NOAA/GSHHS
high-resolution level-1 ocean/land shoreline. Level-1 filtering excludes
inland lake and pond boundaries.

GSHHS is an ocean-shoreline proxy rather than a surveyed legal mean-high-water
line. That approximation is recorded in source provenance. The value is cached
for one year with the other property characteristics and sent to QuoteRUSH as
the Miles to Coast property field.

Design wind speed and Wind-Borne Debris Region columns remain available for a
future manual or verified polygon source, but automated contour-line values are
not populated or sent. A nearby contour-line envelope cannot establish which
side of the contour contains the property and can overstate inland homes.