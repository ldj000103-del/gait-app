# 운동 3D 모형 출처 (assets/exercise3d)

준비·정리 운동 상세 화면과 걸음 수업의 3D 모형(.glb 12개)은 아래 모델로 만들었어요.

- Human Base Meshes v1.4.1, Blender Studio — CC0 (https://www.blender.org/download/demo-files/) : 'Body Male - Primitive (Stylized)' 마네킹(얼굴 부분 뺌). 자세와 동작은 직접 만들었어요(남의 모션 파일 없음).
- BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan (https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20100816/README_e.html · 라이선스 https://creativecommons.org/licenses/by-sa/2.1/jp/)
- Z-Anatomy - The libre 3D atlas of anatomy - CC-BY-SA 4.0, Gauthier Kervyn 외 (https://github.com/Z-Anatomy/Models-of-human-anatomy · 라이선스 https://creativecommons.org/licenses/by-sa/4.0/)

정리 운동 4개(calf·quad·ham·glute)는 마네킹 피부를 반투명으로 바꾸고, 그 안에 Z-Anatomy(BodyParts3D 바탕)의 근육 메시를 넣었어요: 비복근(안·바깥 갈래)·가자미근·아킬레스건(calf), 대퇴사두근(quad), 햄스트링(ham), 대둔근·중둔근(glute). 근육은 마네킹 마디 길이에 맞춰 늘이고 줄인 뒤(단면 75%, 관절을 넘는 끝은 마디 안으로 눌러 넣음), 마디와 함께 움직이게 붙이고, 면 수를 줄이고 색을 바꿨어요.

근육이 든 4개 파일(calf·quad·ham·glute.glb)은 CC BY-SA 4.0, 나머지 7개(brisk·march·swing·ankle·heel·jog·slowwalk.glb)는 CC0 마네킹만 쓴 파일이에요(각 파일 asset.copyright에도 적혀 있어요).

걸음 수업 '걸을 때 발바닥에서 일어나는 일'의 footpress.glb는 Z-Anatomy(BodyParts3D 바탕)의 오른쪽 무릎 아래 뼈(넓적다리뼈 아래끝·정강이뼈·종아리뼈·발목뼈·발허리뼈·발가락뼈)와 근육(전경골근·가자미근·비복근·후경골근·장지굴근·장무지굴근·엄지발가락벌림근)·아킬레스건을 그대로 쓰고, 그 겉에 운동 화면과 같은 Human Base Meshes(CC0) 마네킹의 넓적다리 아래쪽·정강이·발·발가락을 반투명 피부로 씌웠어요(해부 모형 크기에 맞춰 키우고, 근육이 밖으로 나오지 않게 둘레를 넓힘). 정강이·발·발가락 3마디 뼈대로 움직이게 하고 색을 바꿨어요. 이 파일도 CC BY-SA 4.0이에요(만든 스크립트: footpress.py).

근육이 든 3D 모형 파일(.glb)은 CC BY-SA 4.0으로 누구나 같은 조건으로 쓸 수 있습니다(LICENSE, https://creativecommons.org/licenses/by-sa/4.0/deed.ko). 각 파일의 glTF asset.copyright에도 출처가 들어 있어요. 원본 모델은 있는 그대로 제공되며, 보증에 관한 사항은 각 라이선스 원문을 따릅니다. 이 폴더의 파일에만 적용되며 저장소의 다른 파일 라이선스는 바뀌지 않아요.

## 만든 방법 (참고)
- Blender 5.2 스크립트(render_ex2.py, zan_extract.py)로 자세를 계산해 50프레임(10fps, 5초 고리)을 마디별 키프레임으로 넣고 glTF 2.0(.glb)로 내보냈어요. 압축(Draco·meshopt)·암호화 없음.
