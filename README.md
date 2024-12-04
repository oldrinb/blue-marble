The Blue Marble

Real-time rendering of Earth using realistic textures, normal mapping and Blinn-Phong reflection model. This project was innitially made as a desktop application using OpenGL in C++; a second version was made later in JavaScript and WebGL.

To achieve a realistic appearance, three different diffuse textures are used: for the daytime, the nighttime, and one for the clouds. A gloss map, obtained by thresholding the red channel of the daytime image, is used to implement the reflection of the sunlight on the surface of the oceans.

The lighting calculation is implemented using Blinn-Phong reflection model. In order to enhance the appearance of the surface and add more details, a technique called "normal mapping" is used during the fragment processing. By altering the lighting calculation, a illusion of depth is created without increasing the complexity of the mesh.

Project: oldrinb.dev/blue-marble

References:

[1] Randi J. Rost, Bill Licea-Kane. OpenGL Shading Language, Third Edition, Addison-Wesley Professional, p. 300-309, 2009

[2] John Kessenich, Graham Sellers, Dave Shreiner. OpenGL Programming Guide, Ninth Edition. Addison-Wesley Professional, p. 456 - 486, 540 - 550, 2017

Images used for this project were obtained from the NASA website and were created by Reto StÃ¶ckli of the NASA Goddard Space Flight Center. The normal map is computed from a topographic map created by Jesse Allen, NASA's Earth Observatory.

https://earthobservatory.nasa.gov/features/BlueMarble/BlueMarble_2002.php

https://www.visibleearth.nasa.gov/images/73934/topography
