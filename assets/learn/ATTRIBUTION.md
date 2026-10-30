# 홈 '배워 보기' 카드 그림 출처 (assets/learn)

홈 '배워 보기' 카드의 작은 그림 50장은 걸음 수업과 같은 3D 모형(assets/exercise3d/footpress.glb)을 30초 수업의 기본 보기(바깥쪽에서 30° 앞)로 렌더링한 것입니다. 걸음 한 주기를 2% 간격으로 담았고(l00 = 0%, l49 = 98%), 그 순간 일하는 근육만 빨갛게 칠했어요(Perry 『Gait Analysis』 4장 근육 순서, timeline.json). 이용자의 측정값과는 연결되지 않습니다.

모형의 원본과 라이선스는 assets/exercise3d/ATTRIBUTION.md와 같습니다.

- BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan (https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20100816/README_e.html · 라이선스 https://creativecommons.org/licenses/by-sa/2.1/jp/)
- Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0, Gauthier Kervyn 외 (https://github.com/Z-Anatomy/Models-of-human-anatomy · 라이선스 https://creativecommons.org/licenses/by-sa/4.0/)
- Human Base Meshes, Blender Studio (CC0)

이 그림 파일들은 CC BY-SA 4.0으로 누구나 같은 조건으로 쓸 수 있습니다(https://creativecommons.org/licenses/by-sa/4.0/deed.ko). 이 폴더의 그림에만 적용되며(LICENSE), 저장소의 다른 파일 라이선스는 바뀌지 않아요.

## 만든 방법 (참고)

- Blender 5.2, footpress.glb를 10fps로 불러와 짝수 프레임 50장, 세로 시야 26° 카메라(3D 수업과 같은 방향), 배경 투명 → WebP 192×232.
- 근육 색 = timeline.json 세기 × 2.5(30초 수업과 같음). 작은 그림에서 근육이 보이게 피부 투명도는 0.28(3D는 0.40).
