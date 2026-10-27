# 뼈 그림 출처 (assets/bones)

걸음걸이 탭의 뼈 그림은 아래 3D 모델에서 골반·넓적다리뼈·무릎뼈·정강이뼈·종아리뼈·발뼈를 골라 옆·앞·뒤 방향으로 렌더링하고 색과 조명을 바꾼 것이며, 앱은 이 그림을 이용자의 관절 각도에 맞춰 돌리고 이어 붙여 보여 줍니다.

- BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan (https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20100816/README_e.html · 라이선스 https://creativecommons.org/licenses/by-sa/2.1/jp/)
- Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0, Gauthier Kervyn 외 (https://github.com/Z-Anatomy/Models-of-human-anatomy · 라이선스 https://creativecommons.org/licenses/by-sa/4.0/)

이 뼈 그림 파일들은 CC BY-SA 4.0으로 누구나 같은 조건으로 쓸 수 있습니다(https://creativecommons.org/licenses/by-sa/4.0/deed.ko). 원본 모델은 있는 그대로 제공되며, 보증에 관한 사항은 각 라이선스 원문을 따릅니다.

## 만든 방법 (참고)

- 원본: Z-Anatomy `Startup.blend`의 '1: Skeletal system'에서 아래 뼈만 새 장면으로 옮겨 렌더링했어요. 다른 출처 모델(Inner Ear, Kidney, Brainder·White matter 등)은 렌더링 장면에 넣지 않았어요.
  - 골반: Hip bone.r, Hip bone.l, Sacrum, Coccyx
  - 넓적다리: Femur.r, Patella.r
  - 정강이·종아리: Tibia.r, Fibula.r
  - 발: Talus, Calcaneus, Navicular, Cuboid, 쐐기뼈 3개, 발허리뼈 5개, 발가락뼈, 종자뼈 (오른쪽)
- Blender 5.2, 정사영 카메라, 1m = 600px, 배경 투명 → WebP. 왼쪽 다리는 앱에서 오른쪽 그림을 좌우로 뒤집어 씀.
- bones.json: 그림별 크기와 관절 중심(고관절·무릎·발목·엉치뼈 위) 픽셀 좌표.
- 이 폴더의 그림에만 CC BY-SA 4.0이 적용되며(LICENSE), 저장소의 다른 파일 라이선스는 바뀌지 않아요.
